import { randomBytes } from "node:crypto";

import {
  ActionRowBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ChannelType,
  type Client,
  EmbedBuilder,
  type Guild as DiscordGuild,
  type GuildMember,
  type GuildTextBasedChannel,
  MessageFlags,
  ModalBuilder,
  type ModalSubmitInteraction,
  type OverwriteResolvable,
  PermissionFlagsBits,
  type StringSelectMenuInteraction,
  type TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
} from "discord.js";

import {
  isTemplateEmpty,
  type AccessRule,
  type Guild,
  type MessageTemplate,
  type NewTicketMessage,
  type Panel,
  type Ticket,
  type TicketPriority,
} from "@/db/schema";
import { env } from "@/lib/env";
import type { AuditAction } from "@/lib/audit";
import { recordAuditEvent } from "@/lib/queries/audit";
import {
  CATEGORY_CHANNEL_LIMIT,
  CATEGORY_WARN_AT,
  categoryRemaining,
} from "@/lib/category-capacity";
import { isEscalatedPriority, priorityMeta } from "@/lib/ticket-priority";
import { renderTemplate } from "./message-template";
import {
  appendAutoOverflowCategory,
  getGuild,
  nextTicketNumber,
} from "@/lib/queries/guild";
import { getPanel, isOnCooldown, startCooldown } from "@/lib/queries/panels";
import {
  clearCloseRequest,
  countOpenTicketsForUser,
  countTicketMessages,
  createTicket,
  createTranscript,
  getTicket,
  getTicketByChannel,
  listAutoCloseCandidates,
  listDueCloseRequests,
  markTicketAutoCloseWarned,
  markTicketClosed,
  saveTicketRating,
  setCloseRequest,
  setTicketClaimedBy,
  setTicketNotesThread,
  setTicketPanel,
  setTicketPriority,
  upsertTicketMessages,
} from "@/lib/queries/tickets";
import { getCannedResponse } from "@/lib/queries/canned-responses";
import { findBlacklistMatch } from "@/lib/queries/blacklist";
import { archiveTicketAttachments } from "./attachment-archive";
import { EMBED_COLOR, noticeEmbed } from "./embeds";
import { messageToRow } from "./message-snapshot";
import {
  channelName,
  isCategoryFullError,
  sanitizePrefix,
  topicForPriority,
} from "./ticket-format";
import { notifyOnCallStaff } from "./on-call";
import { isStaffMember } from "./staff";
import { trackTicketChannel, untrackTicketChannel } from "./ticket-channels";

type Interaction =
  | ButtonInteraction
  | ChatInputCommandInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;
type OpenInteraction =
  | ButtonInteraction
  | ModalSubmitInteraction
  | StringSelectMenuInteraction;
export type FormAnswer = { question: string; answer: string };

/** Promise-based delay. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** First configured (non-empty) template among the candidates, else null. */
function pickTemplate(
  ...candidates: (MessageTemplate | null | undefined)[]
): MessageTemplate | null {
  for (const t of candidates) if (t && !isTemplateEmpty(t)) return t;
  return null;
}

/** A single-button action row linking out to a URL (e.g. a transcript). */
function linkButtonRow(
  label: string,
  url: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url),
  );
}

/** The built-in "Ticket Closed" summary embed used for the DM and channel post. */
function buildCloseEmbed(
  guild: DiscordGuild,
  ticket: Ticket,
  closerId: string,
  reason: string | undefined,
): EmbedBuilder {
  const openedUnix = Math.floor(ticket.openedAt.getTime() / 1000);
  return new EmbedBuilder()
    .setColor(EMBED_COLOR.info)
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() ?? undefined })
    .setTitle("Ticket Closed")
    .addFields(
      { name: "Ticket ID", value: String(ticket.number), inline: true },
      { name: "Opened By", value: `<@${ticket.openerId}>`, inline: true },
      { name: "Closed By", value: `<@${closerId}>`, inline: true },
      { name: "Open Time", value: `<t:${openedUnix}:f>`, inline: true },
      {
        name: "Claimed By",
        value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Not claimed",
        inline: true,
      },
      { name: "         ", value: "         ", inline: true },
      {
        name: "Reason",
        value: reason?.trim() ? reason.slice(0, 1024) : "No reason provided",
      },
    )
    .setTimestamp();
}

/** Permissions granted to a member with access to a ticket channel. */
const TICKET_MEMBER_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

async function replyError(interaction: Interaction, content: string) {
  const payload = {
    embeds: [noticeEmbed(content, EMBED_COLOR.danger)],
    flags: MessageFlags.Ephemeral as const,
  };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

/** Whether the interacting member is support staff (staff role or manager). */
function isStaff(interaction: Interaction, config: Guild): boolean {
  const member = interaction.inCachedGuild() ? interaction.member : null;
  return member ? isStaffMember(member, config) : false;
}

/** The ticket opener or any staff member may act on a ticket. */
function canManageTicket(
  interaction: Interaction,
  config: Guild,
  ticket: Ticket,
): boolean {
  return interaction.user.id === ticket.openerId || isStaff(interaction, config);
}

type ButtonVisibility = {
  hideClaim: boolean;
  hideClose: boolean;
  hideCloseWithReason: boolean;
};

/** Button-visibility flags for a ticket's panel (all shown if no panel). */
function buttonVisibility(panel: Panel | null): ButtonVisibility {
  return {
    hideClaim: panel?.hideClaim ?? false,
    hideClose: panel?.hideClose ?? false,
    hideCloseWithReason: panel?.hideCloseWithReason ?? false,
  };
}

/**
 * Buttons shown on the ticket's opening message, reflecting claim state and the
 * panel's button-visibility settings. Returns an empty array if all are hidden.
 */
function buildControls(
  vis: ButtonVisibility,
  ticketId: string,
  claimedBy: string | null,
): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = [];

  if (!vis.hideClaim) {
    buttons.push(
      claimedBy
        ? new ButtonBuilder()
            .setCustomId(`unclaim_ticket:${ticketId}`)
            .setLabel("Release")
            .setEmoji("🙌")
            .setStyle(ButtonStyle.Secondary)
        : new ButtonBuilder()
            .setCustomId(`claim_ticket:${ticketId}`)
            .setLabel("Claim")
            .setEmoji("🙋")
            .setStyle(ButtonStyle.Success),
    );
  }
  if (!vis.hideClose) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`close_ticket:${ticketId}`)
        .setLabel("Close")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger),
    );
  }
  if (!vis.hideCloseWithReason) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`close_reason:${ticketId}`)
        .setLabel("Close with reason")
        .setEmoji("📝")
        .setStyle(ButtonStyle.Danger),
    );
  }

  if (buttons.length === 0) return [];
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

/**
 * Evaluate a panel's access-control rules against a member's roles,
 * top-to-bottom, first match wins. With no rules, everyone may open. If there
 * are `allow` rules but none match, it's treated as a whitelist and denied.
 */
function checkAccess(member: GuildMember, rules: AccessRule[]): boolean {
  if (rules.length === 0) return true;
  for (const rule of rules) {
    if (member.roles.cache.has(rule.roleId)) return rule.action === "allow";
  }
  return !rules.some((r) => r.action === "allow");
}

/** Build the "close with reason" modal. */
export function buildCloseReasonModal(ticketId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`close_reason_modal:${ticketId}`)
    .setTitle("Close ticket")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("Reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000),
      ),
    );
}

const FEEDBACK_STARS = [1, 2, 3, 4, 5];

/** Rating prompt DMed to the opener on close when feedback is enabled. */
function buildFeedbackPrompt(ticket: Ticket, guildName: string) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR.info)
    .setTitle("How was your support experience?")
    .setDescription(
      `Ticket #${ticket.number} in **${guildName}** was closed. Tap a star to rate the support you received — 1 (poor) to 5 (great).`,
    );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...FEEDBACK_STARS.map((n) =>
      new ButtonBuilder()
        .setCustomId(`rate:${ticket.id}:${n}`)
        .setLabel(String(n))
        .setEmoji("⭐")
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return { embeds: [embed], components: [row] };
}

/** Optional-comment modal shown after the opener picks a star. */
function buildFeedbackModal(ticketId: string, score: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`feedback:${ticketId}:${score}`)
    .setTitle(`Rate: ${score}/5 ⭐`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("comment")
          .setLabel("Any comments? (optional)")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000),
      ),
    );
}

/**
 * Opener tapped a star on the feedback DM: verify it's their ticket, then open
 * the optional-comment modal (which persists the rating on submit).
 */
export async function startTicketFeedback(
  interaction: ButtonInteraction,
  ticketId: string,
  score: number,
): Promise<void> {
  if (!Number.isInteger(score) || score < 1 || score > 5) return;
  const ticket = await getTicket(ticketId);
  if (!ticket || ticket.openerId !== interaction.user.id) {
    await interaction
      .reply({
        embeds: [noticeEmbed("This rating isn't for you.", EMBED_COLOR.danger)],
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }
  await interaction.showModal(buildFeedbackModal(ticketId, score));
}

/** Persist the opener's rating + optional comment and thank them. */
export async function submitTicketFeedback(
  interaction: ModalSubmitInteraction,
  ticketId: string,
  score: number,
): Promise<void> {
  if (!Number.isInteger(score) || score < 1 || score > 5) return;
  const ticket = await getTicket(ticketId);
  if (!ticket || ticket.openerId !== interaction.user.id) return;

  const comment = interaction.fields.getTextInputValue("comment").trim();
  const saved = await saveTicketRating(ticketId, score, comment || null);

  await interaction
    .reply({
      embeds: [
        noticeEmbed(
          saved
            ? `Thanks for rating your support ${score}/5 ⭐`
            : "Thanks for your feedback!",
          EMBED_COLOR.success,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});

  // Lock the prompt so it reads as answered and can't be re-submitted.
  await interaction.message
    ?.edit({
      embeds: [
        noticeEmbed(
          `Thanks for your feedback — you rated ticket #${ticket.number} ${score}/5 ⭐`,
          EMBED_COLOR.success,
        ),
      ],
      components: [],
    })
    .catch(() => {});
}

/** Structured half of a logged action — the row kept in the audit trail. */
type AuditDetail = {
  action: AuditAction;
  /** Discord user who acted; omit for the bot's own sweeps. */
  actorId?: string | null;
  actorName?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Record something that happened: post it to the configured log channel (if
 * any) and append it to the guild's durable audit trail.
 *
 * The two go together on purpose — the log channel is the feed staff watch, the
 * trail is what survives a channel purge and can be filtered in the dashboard.
 * A guild with no log channel still gets the trail.
 */
async function logAction(
  guild: DiscordGuild,
  config: Guild,
  content: string,
  { color = EMBED_COLOR.neutral, audit }: { color?: number; audit?: AuditDetail } = {},
): Promise<void> {
  if (audit) {
    await recordAuditEvent({
      guildId: guild.id,
      // The bot writes on behalf of a member, except for its own sweeps.
      source: audit.actorId ? "bot" : "system",
      action: audit.action,
      actorId: audit.actorId ?? null,
      actorName: audit.actorName ?? null,
      targetType: audit.targetType ?? null,
      targetId: audit.targetId ?? null,
      summary: content,
      metadata: audit.metadata ?? {},
    });
  }

  if (!config.logChannelId) return;
  const channel = await guild.channels
    .fetch(config.logChannelId)
    .catch(() => null);
  if (channel?.isTextBased()) {
    await channel
      .send({
        embeds: [noticeEmbed(content, color).setTimestamp()],
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  }
}

type OpenContext = {
  config: Guild;
  categoryId: string;
  staffRoleIds: string[];
  openerIsStaff: boolean;
};

/**
 * Validate that a ticket can be opened from this panel and resolve the effective
 * settings (category, staff roles). Applies: panel disabled, configured, access
 * control, per-user limit, and per-panel cooldown (staff exempt). Replies with
 * an error and returns null if blocked.
 */
async function precheckOpen(
  interaction: OpenInteraction,
  panel: Panel,
): Promise<OpenContext | null> {
  if (!interaction.inCachedGuild()) return null;
  const { guildId, user, member } = interaction;

  if (panel.disabled) {
    await replyError(interaction, "This panel is currently disabled.");
    return null;
  }

  const config = await getGuild(guildId);
  const categoryId = panel.categoryId ?? config?.ticketCategoryId ?? null;
  if (!config || !categoryId) {
    await replyError(
      interaction,
      "Tickets aren't fully configured on this server yet. Ask an admin to set a ticket category in the dashboard.",
    );
    return null;
  }

  // Blacklist: block the member up front if they (or one of their roles) are
  // banned from opening tickets in this guild.
  const banned = await findBlacklistMatch(guildId, user.id, [
    ...member.roles.cache.keys(),
  ]);
  if (banned) {
    await replyError(
      interaction,
      banned.reason?.trim()
        ? `You're blocked from opening tickets in this server: ${banned.reason}`
        : "You're blocked from opening tickets in this server.",
    );
    return null;
  }

  if (!checkAccess(member, panel.accessControl)) {
    await replyError(
      interaction,
      "You don't have permission to open a ticket from this panel.",
    );
    return null;
  }

  const staffRoleIds = panel.supportRoleIds.length
    ? panel.supportRoleIds
    : config.staffRoleIds;
  const openerIsStaff =
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    staffRoleIds.some((r) => member.roles.cache.has(r));

  if (config.ticketLimit > 0) {
    const open = await countOpenTicketsForUser(guildId, user.id);
    if (open >= config.ticketLimit) {
      await replyError(
        interaction,
        `You already have ${open} open ticket${open === 1 ? "" : "s"} (limit ${config.ticketLimit}).`,
      );
      return null;
    }
  }

  if (!openerIsStaff && panel.cooldownSeconds > 0) {
    if (await isOnCooldown(panel.id, user.id)) {
      await replyError(
        interaction,
        "You're opening tickets too quickly — please wait a moment before trying again.",
      );
      return null;
    }
  }

  return { config, categoryId, staffRoleIds, openerIsStaff };
}

/** Build the Discord modal (form) for a panel's questions. */
function buildTicketModal(panel: Panel): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_form:${panel.id}`)
    .setTitle(panel.title.slice(0, 45) || "Open a ticket");

  for (const q of panel.questions.slice(0, 5)) {
    const input = new TextInputBuilder()
      .setCustomId(q.id)
      .setLabel(q.label.slice(0, 45))
      .setStyle(
        q.style === "paragraph" ? TextInputStyle.Paragraph : TextInputStyle.Short,
      )
      .setRequired(q.required);
    if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
  }
  return modal;
}

/**
 * Entry point for the panel "open ticket" button. If the panel has questions,
 * present a modal first; otherwise open the ticket immediately.
 */
export async function openTicketFromPanel(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  panelId: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const panel = await getPanel(panelId);
  if (!panel) {
    await replyError(interaction, "This panel no longer exists.");
    return;
  }

  const ctx = await precheckOpen(interaction, panel);
  if (!ctx) return;

  if (panel.questions.length > 0) {
    await interaction.showModal(buildTicketModal(panel));
    return;
  }

  await openTicket(interaction, panel, [], ctx);
}

/** Handle a submitted ticket form modal: collect answers, then open the ticket. */
export async function submitTicketForm(
  interaction: ModalSubmitInteraction,
  panelId: string,
): Promise<void> {
  const panel = await getPanel(panelId);
  if (!panel) {
    await replyError(interaction, "This panel no longer exists.");
    return;
  }
  const answers: FormAnswer[] = panel.questions.map((q) => ({
    question: q.label,
    answer: interaction.fields.getTextInputValue(q.id) || "—",
  }));
  await openTicket(interaction, panel, answers);
}

/** Number of channels currently nested under a category (0 if it's gone). */
function categoryChildCount(guild: DiscordGuild, categoryId: string): number {
  const category = guild.channels.cache.get(categoryId);
  if (category?.type === ChannelType.GuildCategory) {
    return category.children.cache.size;
  }
  return guild.channels.cache.filter((c) => c.parentId === categoryId).size;
}

/**
 * Ticket categories we've already warned about, keyed `guildId:categoryId`.
 *
 * Without this, every open into a near-full category would re-post the warning.
 * An entry is dropped as soon as the category falls back under the threshold
 * (tickets closed, channels deleted), so the warning fires once per crossing
 * rather than once per process.
 */
const warnedFullCategories = new Set<string>();

/**
 * Post a heads-up to the log channel when the category a ticket just landed in
 * is running out of room, so admins can add an overflow category before opens
 * start spilling over. Best-effort and silent when no log channel is set.
 */
async function warnIfCategoryNearLimit(
  guild: DiscordGuild,
  config: Guild,
  categoryId: string | null,
): Promise<void> {
  if (!categoryId) return;
  const key = `${guild.id}:${categoryId}`;
  const used = categoryChildCount(guild, categoryId);

  if (used < CATEGORY_WARN_AT) {
    warnedFullCategories.delete(key);
    return;
  }
  if (warnedFullCategories.has(key)) return;
  warnedFullCategories.add(key);

  const remaining = categoryRemaining(used);
  const room =
    remaining === 0
      ? "It's **full** — further tickets will spill into an overflow category."
      : `Room for **${remaining}** more ticket${remaining === 1 ? "" : "s"}.`;
  const advice = config.autoCreateOverflow
    ? "Auto-overflow is on, so the bot will create a new category when it fills."
    : "Auto-overflow is **off** — add an overflow category in the dashboard, or opens will start failing.";

  await logAction(
    guild,
    config,
    `⚠️ Ticket category <#${categoryId}> is at **${used}/${CATEGORY_CHANNEL_LIMIT}** channels. ${room} ${advice}`,
    {
      color: EMBED_COLOR.danger,
      audit: {
        action: "system.category_full",
        targetType: "category",
        targetId: categoryId,
        metadata: { used, limit: CATEGORY_CHANNEL_LIMIT, remaining },
      },
    },
  );
}

/**
 * Create a fresh overflow category mirroring the primary category's name and
 * permission overwrites (so staff visibility stays consistent), returning its
 * id.
 */
async function createOverflowCategory(
  guild: DiscordGuild,
  primaryCategoryId: string,
  config: Guild,
): Promise<string> {
  const primary = guild.channels.cache.get(primaryCategoryId);
  const category =
    primary?.type === ChannelType.GuildCategory ? primary : null;
  const baseName = category?.name ?? "Tickets";
  const overwrites: OverwriteResolvable[] = category
    ? category.permissionOverwrites.cache.map((o) => ({
        id: o.id,
        type: o.type,
        allow: o.allow.toArray(),
        deny: o.deny.toArray(),
      }))
    : [];
  const n = config.autoOverflowCategoryIds.length + 1;
  const created = await guild.channels.create({
    name: `${baseName} (overflow ${n})`.slice(0, 100),
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites,
  });
  return created.id;
}

/**
 * Create the ticket channel, routing around Discord's 50-channels-per-category
 * limit. Tries the primary category, then the admin-configured overflow chain,
 * then any previously auto-created overflow categories — preferring ones with
 * apparent room but falling back reactively if a create still reports "full"
 * (cached counts can lag reality). If everything is full and auto-create is on,
 * spins up a fresh overflow category and uses it; otherwise returns null so the
 * caller can report that tickets are full.
 */
async function createTicketChannel(
  guild: DiscordGuild,
  config: Guild,
  primaryCategoryId: string,
  opts: { name: string; overwrites: OverwriteResolvable[]; topic: string },
): Promise<TextChannel | null> {
  // Ordered, de-duplicated chain of existing categories to try.
  const chain: string[] = [];
  const seen = new Set<string>();
  for (const id of [
    primaryCategoryId,
    ...config.overflowCategoryIds,
    ...config.autoOverflowCategoryIds,
  ]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (guild.channels.cache.get(id)?.type === ChannelType.GuildCategory) {
      chain.push(id);
    }
  }

  // Prefer categories that look like they have room, keeping the rest as
  // reactive fallbacks. Trying the primary first means capacity freed by closed
  // tickets is naturally reclaimed before overflow categories fill.
  const hasRoom = (id: string) =>
    categoryChildCount(guild, id) < CATEGORY_CHANNEL_LIMIT;
  const ordered = [
    ...chain.filter(hasRoom),
    ...chain.filter((id) => !hasRoom(id)),
  ];

  const create = (parent: string) =>
    guild.channels.create({
      name: opts.name,
      type: ChannelType.GuildText,
      parent,
      permissionOverwrites: opts.overwrites,
      topic: opts.topic,
    });

  for (const categoryId of ordered) {
    try {
      return await create(categoryId);
    } catch (err) {
      if (isCategoryFullError(err)) continue; // full — try the next category
      throw err; // real failure (perms, invalid) — bubble to the caller
    }
  }

  // Everything is full. Auto-create a fresh overflow category if allowed.
  if (!config.autoCreateOverflow) return null;
  const overflowId = await createOverflowCategory(
    guild,
    primaryCategoryId,
    config,
  );
  await appendAutoOverflowCategory(guild.id, overflowId);
  return create(overflowId);
}

/**
 * Create a ticket: a private channel under the (panel or server) category with
 * per-user/staff overwrites, persist it (with any form answers), post a welcome
 * message honoring the panel's overrides (mentions, welcome text, colour,
 * images, buttons), and start the panel cooldown.
 */
export async function openTicket(
  interaction: OpenInteraction,
  panel: Panel,
  answers: FormAnswer[],
  preresolved?: OpenContext,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guild, guildId, user } = interaction;

  const ctx = preresolved ?? (await precheckOpen(interaction, panel));
  if (!ctx) return;
  const { config, categoryId, staffRoleIds, openerIsStaff } = ctx;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const number = await nextTicketNumber(guildId);

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: TICKET_MEMBER_PERMS },
    ...staffRoleIds.map((roleId) => ({
      id: roleId,
      allow: TICKET_MEMBER_PERMS,
    })),
  ];

  const scheme = panel.namingScheme || config.namingScheme;

  let channel: TextChannel;
  try {
    const created = await createTicketChannel(guild, config, categoryId, {
      name: channelName(scheme, number, user.username),
      overwrites,
      topic: `Ticket #${number} · opened by ${user.tag} <@${user.id}>`,
    });
    if (!created) {
      await replyError(
        interaction,
        "Every ticket category is full — Discord allows 50 channels per category. Ask an admin to add an overflow category or turn on auto-overflow in the dashboard.",
      );
      return;
    }
    channel = created;
  } catch (err) {
    console.error("Failed to create ticket channel:", err);
    await replyError(
      interaction,
      "I couldn't create the ticket channel. Check that my role can Manage Channels and that the category is valid.",
    );
    return;
  }

  const ticket = await createTicket({
    guildId,
    number,
    channelId: channel.id,
    openerId: user.id,
    panelId: panel.id,
    formResponses: answers,
  });

  // Begin capturing this channel's messages for the transcript.
  trackTicketChannel(channel.id, ticket.id);

  if (!openerIsStaff && panel.cooldownSeconds > 0) {
    await startCooldown(panel.id, user.id, panel.cooldownSeconds);
  }

  // Respond to the opener as soon as the channel exists so the button doesn't
  // sit on "thinking…". The welcome message and audit log are best-effort.
  await interaction.editReply({
    embeds: [
      noticeEmbed(`Your ticket is ready: <#${channel.id}>`, EMBED_COLOR.success),
    ],
  });

  // Form answers are shown as embed fields regardless of which path builds the
  // welcome message.
  const answerFields = answers.map((a) => ({
    name: a.question.slice(0, 256),
    value: (a.answer || "—").slice(0, 1024),
  }));

  // Prefer a configured rich welcome template (panel override → server default);
  // otherwise fall back to the legacy embed built from the plain-text fields.
  const welcomeTemplate = pickTemplate(
    panel.welcomeTemplate,
    config.messageTemplates?.welcome,
  );

  let welcomePayload: { content?: string; embeds: EmbedBuilder[] };
  if (welcomeTemplate) {
    const rendered = renderTemplate(welcomeTemplate, {
      ticket: String(number),
      number: String(number),
      username: user.username,
      user: `<@${user.id}>`,
      opener: `<@${user.id}>`,
      server: guild.name,
      channel: `<#${channel.id}>`,
    });
    // Show the form answers in their own embed, kept separate from the rich
    // welcome. If we're already at Discord's 10-embed limit, fall back to
    // appending them to the last embed rather than dropping them.
    if (answerFields.length > 0) {
      if (rendered.embeds.length < 10) {
        rendered.embeds.push(
          new EmbedBuilder()
            .setTitle("Form responses")
            .setColor(panel.color)
            .addFields(answerFields.slice(0, 25)),
        );
      } else {
        const target = rendered.embeds[rendered.embeds.length - 1];
        const used = target.data.fields?.length ?? 0;
        target.addFields(answerFields.slice(0, Math.max(0, 25 - used)));
      }
    }
    welcomePayload = { content: rendered.content, embeds: rendered.embeds };
  } else {
    const embed = new EmbedBuilder()
      .setTitle(`${panel.title || "Ticket"} (#${number})`)
      .setDescription(panel.welcomeMessage || config.welcomeMessage)
      .setColor(panel.color);
    if (panel.largeImageUrl) embed.setImage(panel.largeImageUrl);
    if (panel.smallImageUrl) embed.setThumbnail(panel.smallImageUrl);
    if (answerFields.length > 0) embed.addFields(answerFields);
    welcomePayload = { embeds: [embed] };
  }

  try {
    await channel.send({
      ...welcomePayload,
      components: buildControls(buttonVisibility(panel), ticket.id, null),
    });
  } catch (err) {
    console.error("Failed to post ticket welcome message:", err);
  }

  await logAction(
    guild,
    config,
    `🎫 Ticket #${number} opened by <@${user.id}> — <#${channel.id}>`,
    {
      audit: {
        action: "ticket.open",
        actorId: user.id,
        actorName: user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number, panel: panel.title, channelId: channel.id },
      },
    },
  );

  // Reach whoever is holding the pager, so triage doesn't wait on a whole
  // support role noticing the new channel.
  const onCall = await notifyOnCallStaff(guild, config, {
    number,
    channelId: channel.id,
    openerId: user.id,
    panelTitle: panel.title || null,
  });
  if (onCall.notified.length > 0 || onCall.failed.length > 0) {
    const reached = onCall.notified.map((id) => `<@${id}>`).join(", ");
    const missed = onCall.failed.length
      ? ` (couldn't DM ${onCall.failed.map((id) => `<@${id}>`).join(", ")})`
      : "";
    await logAction(
      guild,
      config,
      `🛎️ On-call notified for ticket #${number}: ${reached || "nobody"}${missed}`,
      {
        color:
          onCall.notified.length === 0 ? EMBED_COLOR.danger : EMBED_COLOR.neutral,
        audit: {
          action: "ticket.oncall_notified",
          targetType: "ticket",
          targetId: ticket.id,
          metadata: { notified: onCall.notified, failed: onCall.failed },
        },
      },
    );
  }

  await warnIfCategoryNearLimit(guild, config, channel.parentId);
}

/** Resolve the ticket for an interaction (by id or current channel) + config. */
async function resolveTicket(
  interaction: Interaction,
  ticketId: string | undefined,
): Promise<{ ticket: Ticket; config: Guild } | null> {
  if (!interaction.inCachedGuild()) return null;
  const ticket = ticketId
    ? await getTicket(ticketId)
    : interaction.channelId
      ? await getTicketByChannel(interaction.channelId)
      : null;
  if (!ticket || ticket.guildId !== interaction.guildId) {
    await replyError(interaction, "This isn't a ticket channel.");
    return null;
  }
  const config = await getGuild(interaction.guildId);
  if (!config) {
    await replyError(interaction, "This server isn't configured.");
    return null;
  }
  return { ticket, config };
}

/** Claim (assign) or release a ticket. */
async function setClaim(
  interaction: Interaction,
  ticketId: string | undefined,
  claim: boolean,
): Promise<void> {
  const resolved = await resolveTicket(interaction, ticketId);
  if (!resolved) return;
  const { ticket, config } = resolved;
  const userId = interaction.user.id;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is closed.");
    return;
  }
  if (!isStaff(interaction, config)) {
    await replyError(interaction, "Only staff can claim tickets.");
    return;
  }
  if (claim && ticket.claimedBy && ticket.claimedBy !== userId) {
    await replyError(
      interaction,
      `This ticket is already claimed by <@${ticket.claimedBy}>.`,
    );
    return;
  }
  if (
    !claim &&
    ticket.claimedBy !== userId &&
    !(interaction.inCachedGuild() &&
      interaction.member.permissions.has(PermissionFlagsBits.ManageChannels))
  ) {
    await replyError(
      interaction,
      "Only the staff member who claimed this ticket (or a manager) can release it.",
    );
    return;
  }

  await setTicketClaimedBy(ticket.id, claim ? userId : null);

  // Claiming can use a configured template; releasing keeps the plain notice.
  const claimTemplate = claim
    ? pickTemplate(config.messageTemplates?.claimNotice)
    : null;
  const noticePayload: { content?: string; embeds?: EmbedBuilder[] } =
    claimTemplate
      ? renderTemplate(claimTemplate, {
          claimer: `<@${userId}>`,
          ticket: String(ticket.number),
          number: String(ticket.number),
          server: interaction.guild?.name ?? "",
          channel: `<#${ticket.channelId}>`,
        })
      : {
          embeds: [
            new EmbedBuilder()
              .setColor(claim ? EMBED_COLOR.success : EMBED_COLOR.neutral)
              .setDescription(
                claim
                  ? `🙋 <@${userId}> claimed this ticket.`
                  : `🙌 <@${userId}> released this ticket.`,
              ),
          ],
        };

  // Update the opening message's buttons when acting via them; otherwise post.
  if (interaction.isButton()) {
    const panel = ticket.panelId ? await getPanel(ticket.panelId) : null;
    await interaction
      .update({
        components: buildControls(
          buttonVisibility(panel),
          ticket.id,
          claim ? userId : null,
        ),
      })
      .catch(() => {});
    if (interaction.channel?.isSendable()) {
      await interaction.channel.send(noticePayload).catch(() => {});
    }
  } else {
    await interaction.reply(noticePayload);
  }

  await logAction(
    interaction.guild!,
    config,
    `${claim ? "🙋" : "🙌"} Ticket #${ticket.number} ${claim ? "claimed" : "released"} by <@${userId}>`,
    {
      audit: {
        action: claim ? "ticket.claim" : "ticket.unclaim",
        actorId: userId,
        actorName: interaction.user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number: ticket.number },
      },
    },
  );
}

export const claimTicket = (
  interaction: Interaction,
  ticketId?: string,
): Promise<void> => setClaim(interaction, ticketId, true);

export const unclaimTicket = (
  interaction: Interaction,
  ticketId?: string,
): Promise<void> => setClaim(interaction, ticketId, false);

/**
 * Set (or, with no `priority`, report) the ticket's triage priority. Staff only.
 *
 * Beyond the stored value the priority shows up as a badge on the channel topic
 * so it's visible in the channel list, and — when the guild opts in — exempts
 * escalated tickets from inactivity auto-close.
 */
export async function changeTicketPriority(
  interaction: ChatInputCommandInteraction,
  priority: TicketPriority | null,
): Promise<void> {
  const resolved = await resolveTicket(interaction, undefined);
  if (!resolved) return;
  const { ticket, config } = resolved;

  // Reporting the current priority is read-only, so anyone in the ticket may.
  if (!priority) {
    const meta = priorityMeta(ticket.priority);
    await interaction.reply({
      embeds: [
        noticeEmbed(
          `${meta.emoji} This ticket's priority is **${meta.label}**.`,
          meta.embedColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is closed.");
    return;
  }
  if (!isStaff(interaction, config)) {
    await replyError(interaction, "Only staff can set a ticket's priority.");
    return;
  }

  const meta = priorityMeta(priority);
  if (ticket.priority === priority) {
    await interaction.reply({
      embeds: [
        noticeEmbed(
          `This ticket is already **${meta.label}** priority.`,
          meta.embedColor,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Channel edits share Discord's heavily rate-limited rename bucket, so defer.
  await interaction.deferReply();
  await setTicketPriority(ticket.id, priority);

  // Best-effort: the stored priority is what matters, the topic badge is a hint.
  const channel = await interaction
    .guild!.channels.fetch(ticket.channelId)
    .catch(() => null);
  if (channel && !channel.isThread() && "setTopic" in channel) {
    await channel
      .setTopic(topicForPriority(channel.topic ?? "", priority))
      .catch((err) =>
        console.error("Failed to update ticket topic for priority:", err),
      );
  }

  const previous = priorityMeta(ticket.priority);
  await interaction.editReply({
    embeds: [
      noticeEmbed(
        `${meta.emoji} <@${interaction.user.id}> set this ticket's priority to **${meta.label}** (was ${previous.label}).`,
        meta.embedColor,
      ),
    ],
  });
  await logAction(
    interaction.guild!,
    config,
    `${meta.emoji} Ticket #${ticket.number} priority set to **${meta.label}** by <@${interaction.user.id}>`,
    {
      audit: {
        action: "ticket.priority",
        actorId: interaction.user.id,
        actorName: interaction.user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number: ticket.number, from: previous.value, to: priority },
      },
    },
  );
}

/** Add or remove a member's access to the current ticket channel. */
export async function setTicketMember(
  interaction: ChatInputCommandInteraction,
  targetId: string,
  add: boolean,
): Promise<void> {
  const resolved = await resolveTicket(interaction, undefined);
  if (!resolved) return;
  const { ticket, config } = resolved;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is closed.");
    return;
  }
  if (!canManageTicket(interaction, config, ticket)) {
    await replyError(
      interaction,
      "Only the ticket opener or staff can manage members.",
    );
    return;
  }

  const channel = await interaction
    .guild!.channels.fetch(ticket.channelId)
    .catch(() => null);
  if (!channel || channel.isThread() || !("permissionOverwrites" in channel)) {
    await replyError(interaction, "Couldn't access the ticket channel.");
    return;
  }

  try {
    if (add) {
      await channel.permissionOverwrites.edit(targetId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      await interaction.reply({
        embeds: [
          noticeEmbed(`➕ Added <@${targetId}> to the ticket.`, EMBED_COLOR.success),
        ],
      });
    } else {
      await channel.permissionOverwrites.delete(targetId);
      await interaction.reply({
        embeds: [
          noticeEmbed(
            `➖ Removed <@${targetId}> from the ticket.`,
            EMBED_COLOR.neutral,
          ),
        ],
      });
    }
  } catch (err) {
    console.error("Failed to update ticket member:", err);
    await replyError(interaction, "I couldn't update that member's access.");
  }
}

/**
 * Rename a ticket channel's prefix while preserving its `-<number>` suffix, so
 * the ticket's identity is never lost (e.g. `/rename bug` on ticket 42 →
 * `bug-42`). Staff only.
 */
/**
 * Post a saved canned response into the current channel. Usable by staff in any
 * channel; if it's a ticket channel, ticket placeholders are also filled.
 */
export async function sendCannedResponse(
  interaction: ChatInputCommandInteraction,
  responseId: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const response = await getCannedResponse(responseId);
  if (!response || response.guildId !== interaction.guildId) {
    await replyError(interaction, "That canned response no longer exists.");
    return;
  }

  const config = await getGuild(interaction.guildId);
  const member = interaction.member;
  const isManager = member.permissions.has(PermissionFlagsBits.ManageChannels);
  const hasStaffRole = (config?.staffRoleIds ?? []).some((r) =>
    member.roles.cache.has(r),
  );
  if (!isManager && !hasStaffRole) {
    await replyError(interaction, "Only staff can use canned responses.");
    return;
  }
  // Per-response role restriction (empty = any staff; managers always allowed).
  if (
    response.accessRoleIds.length > 0 &&
    !isManager &&
    !response.accessRoleIds.some((r) => member.roles.cache.has(r))
  ) {
    await replyError(
      interaction,
      "You don't have access to that canned response.",
    );
    return;
  }

  // Fill placeholders; resolve optional ticket context for the ticket tokens.
  const ticket = interaction.channelId
    ? await getTicketByChannel(interaction.channelId)
    : null;
  const vars: Record<string, string> = {
    server: interaction.guild.name,
    channel: `<#${interaction.channelId}>`,
  };
  if (ticket && ticket.guildId === interaction.guildId) {
    vars.ticket = String(ticket.number);
    vars.number = String(ticket.number);
    vars.opener = `<@${ticket.openerId}>`;
  }

  const payload = renderTemplate(response.template, vars);
  if (!payload.content && payload.embeds.length === 0) {
    await replyError(interaction, "That canned response is empty.");
    return;
  }

  // Post publicly in the channel as the command's reply.
  await interaction.reply({ content: payload.content, embeds: payload.embeds });
}

export async function renameTicket(
  interaction: ChatInputCommandInteraction,
  rawPrefix: string,
): Promise<void> {
  const resolved = await resolveTicket(interaction, undefined);
  if (!resolved) return;
  const { ticket, config } = resolved;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is closed.");
    return;
  }
  if (!isStaff(interaction, config)) {
    await replyError(interaction, "Only staff can rename tickets.");
    return;
  }

  const prefix = sanitizePrefix(rawPrefix);
  if (!prefix) {
    await replyError(
      interaction,
      "Please provide a valid name using letters, numbers, or dashes.",
    );
    return;
  }
  const newName = `${prefix}-${ticket.number}`;

  const channel = await interaction
    .guild!.channels.fetch(ticket.channelId)
    .catch(() => null);
  if (!channel || channel.isThread() || !("setName" in channel)) {
    await replyError(interaction, "Couldn't access the ticket channel.");
    return;
  }

  // Channel renames are heavily rate-limited by Discord, so defer first.
  await interaction.deferReply();
  try {
    await channel.setName(newName);
  } catch (err) {
    console.error("Failed to rename ticket channel:", err);
    await interaction.editReply({
      embeds: [
        noticeEmbed(
          "I couldn't rename the channel. Check that my role can Manage Channels.",
          EMBED_COLOR.danger,
        ),
      ],
    });
    return;
  }

  await interaction.editReply({
    embeds: [
      noticeEmbed(`✏️ Renamed this ticket to **${newName}**.`, EMBED_COLOR.success),
    ],
  });
  await logAction(
    interaction.guild!,
    config,
    `✏️ Ticket #${ticket.number} renamed to \`${newName}\` by <@${interaction.user.id}>`,
    {
      audit: {
        action: "ticket.rename",
        actorId: interaction.user.id,
        actorName: interaction.user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number: ticket.number, name: newName },
      },
    },
  );
}

/**
 * Switch which panel a ticket belongs to. Updates the association and applies
 * the new panel's meaningful effects: renames the channel to the new panel's
 * naming scheme, moves it to the new panel's category (preserving the ticket's
 * private overwrites), and grants the new panel's support roles access.
 * Existing access is left intact. Staff only.
 */
export async function switchTicketPanel(
  interaction: ChatInputCommandInteraction,
  panelId: string,
): Promise<void> {
  const resolved = await resolveTicket(interaction, undefined);
  if (!resolved) return;
  const { ticket, config } = resolved;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is closed.");
    return;
  }
  if (!isStaff(interaction, config)) {
    await replyError(interaction, "Only staff can switch a ticket's panel.");
    return;
  }

  const panel = await getPanel(panelId);
  if (!panel || panel.guildId !== ticket.guildId) {
    await replyError(interaction, "That panel doesn't exist on this server.");
    return;
  }
  if (ticket.panelId === panel.id) {
    await replyError(interaction, "This ticket already uses that panel.");
    return;
  }

  await interaction.deferReply();

  await setTicketPanel(ticket.id, panel.id);

  let renamedTo: string | null = null;
  const channel = await interaction
    .guild!.channels.fetch(ticket.channelId)
    .catch(() => null);
  if (channel && !channel.isThread() && "permissionOverwrites" in channel) {
    // Rename to the new panel's naming scheme (needs the opener's username for
    // `{username}` schemes; fall back if they've since left the server).
    const opener = await interaction
      .guild!.client.users.fetch(ticket.openerId)
      .catch(() => null);
    const scheme = panel.namingScheme || config.namingScheme;
    const newName = channelName(scheme, ticket.number, opener?.username ?? "user");
    try {
      await channel.setName(newName);
      renamedTo = newName;
    } catch (err) {
      console.error("Failed to rename ticket channel on panel switch:", err);
    }

    // Move to the new panel's category. `lockPermissions: false` is essential —
    // otherwise Discord syncs to the category and wipes the ticket's privacy.
    const categoryId = panel.categoryId ?? config.ticketCategoryId ?? null;
    if (categoryId && channel.parentId !== categoryId) {
      await channel
        .setParent(categoryId, { lockPermissions: false })
        .catch((err) => console.error("Failed to move ticket channel:", err));
    }

    // Grant the new panel's support roles access to the channel.
    const roleIds = panel.supportRoleIds.length
      ? panel.supportRoleIds
      : config.staffRoleIds;
    for (const roleId of roleIds) {
      await channel.permissionOverwrites
        .edit(roleId, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        })
        .catch(() => {});
    }
  }

  await interaction.editReply({
    embeds: [
      noticeEmbed(
        `🔀 Switched this ticket to the **${panel.title}** panel` +
          (renamedTo ? ` and renamed it to **${renamedTo}**.` : "."),
        EMBED_COLOR.success,
      ),
    ],
  });
  await logAction(
    interaction.guild!,
    config,
    `🔀 Ticket #${ticket.number} switched to panel "${panel.title}"` +
      (renamedTo ? ` (renamed to \`${renamedTo}\`)` : "") +
      ` by <@${interaction.user.id}>`,
    {
      audit: {
        action: "ticket.switch_panel",
        actorId: interaction.user.id,
        actorName: interaction.user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number: ticket.number, panel: panel.title, renamedTo },
      },
    },
  );
}

/**
 * Open (or reuse) a private, staff-only thread attached to the ticket channel
 * for internal discussion. Because it's a *private* thread, the opener — who
 * only has parent-channel access, not Manage Threads — cannot see it. Staff
 * only.
 */
export async function openStaffNotes(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const resolved = await resolveTicket(interaction, undefined);
  if (!resolved) return;
  const { ticket, config } = resolved;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is closed.");
    return;
  }
  if (!isStaff(interaction, config)) {
    await replyError(interaction, "Only staff can open staff notes.");
    return;
  }

  const guild = interaction.guild!;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Reuse an existing notes thread if one is still live.
  if (ticket.notesThreadId) {
    const existing = await guild.channels
      .fetch(ticket.notesThreadId)
      .catch(() => null);
    if (existing?.isThread()) {
      if (existing.archived) await existing.setArchived(false).catch(() => {});
      await existing.members.add(interaction.user.id).catch(() => {});
      await interaction.editReply({
        embeds: [noticeEmbed(`🗒️ Staff notes: <#${existing.id}>`)],
      });
      return;
    }
  }

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply({
      embeds: [
        noticeEmbed("Couldn't access the ticket channel.", EMBED_COLOR.danger),
      ],
    });
    return;
  }

  let thread;
  try {
    thread = await (channel as TextChannel).threads.create({
      name: `notes`,
      type: ChannelType.PrivateThread,
      invitable: true,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Staff notes for ticket #${ticket.number}`,
    });
  } catch (err) {
    console.error("Failed to create staff notes thread:", err);
    await interaction.editReply({
      embeds: [
        noticeEmbed(
          "I couldn't create the notes thread. Check that I can Create Private Threads here.",
          EMBED_COLOR.danger,
        ),
      ],
    });
    return;
  }

  await setTicketNotesThread(ticket.id, thread.id);

  // Bring in staff: the invoker, plus any cached members of the ticket's
  // support roles (best-effort — the starter message also pings those roles,
  // and members with Manage Threads can see private threads regardless).
  const panel = ticket.panelId ? await getPanel(ticket.panelId) : null;
  const roleIds = panel?.supportRoleIds.length
    ? panel.supportRoleIds
    : config.staffRoleIds;

  // Ping the support roles to pull staff into the private thread, then delete
  // the message — the notification still fires (deleting doesn't retract it),
  // but no mention lingers. A brief settle avoids a send/delete race.
  if (roleIds.length > 0) {
    const mentions = roleIds.map((r) => `<@&${r}>`).join(" ");
    try {
      const ping = await thread.send({
        content: mentions,
        allowedMentions: { roles: roleIds },
      });
      await sleep(1000);
      await ping.delete();
    } catch (err) {
      console.error("Failed to send/delete staff notes ping:", err);
    }
  }

  await interaction.editReply({
    embeds: [
      noticeEmbed(
        `A notes thread has been created for this ticket: <#${thread.id}>`,
        EMBED_COLOR.success,
      ),
    ],
  });
  await logAction(
    guild,
    config,
    `🗒️ Staff notes opened for ticket #${ticket.number} by <@${interaction.user.id}>`,
    {
      audit: {
        action: "ticket.notes",
        actorId: interaction.user.id,
        actorName: interaction.user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number: ticket.number, threadId: thread.id },
      },
    },
  );
}

/**
 * Sweep the channel's entire message history into `ticket_message`, paginating
 * past Discord's 100-per-fetch limit. Real-time listeners already captured most
 * messages; this backfills anything they missed (e.g. sent while the bot was
 * down) and is upserted, so re-runs and overlaps never duplicate rows.
 */
async function captureChannelHistory(
  channel: GuildTextBasedChannel,
  ticketId: string,
): Promise<void> {
  const rows: NewTicketMessage[] = [];
  let before: string | undefined;

  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    for (const message of batch.values()) rows.push(messageToRow(message, ticketId));
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  await upsertTicketMessages(rows);
}

/** Base URL for share links, without a trailing slash. */
function transcriptUrl(token: string): string {
  return `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}/transcripts/${token}`;
}

/**
 * Core close routine, independent of any interaction: sweep the full history
 * into the DB, create a shareable transcript and post its link to the transcript
 * channel, optionally DM the opener, mark the ticket closed, log it, and delete
 * the channel. Used by `/close`, the close-request confirm button, and the
 * auto-close sweeper.
 */
export async function performClose(
  guild: DiscordGuild,
  ticket: Ticket,
  config: Guild,
  closerId: string,
  reason?: string,
): Promise<void> {
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

  // Stop live capture before touching the channel, so the bulk message-delete
  // Discord fires when the channel is removed isn't recorded as user deletions.
  untrackTicketChannel(ticket.channelId);

  // Sweep the history, then create the shareable transcript record.
  let url: string | null = null;
  if (channel?.isTextBased()) {
    try {
      await captureChannelHistory(channel as GuildTextBasedChannel, ticket.id);

      // Archive attachments off Discord's expiring CDN before the channel is
      // gone, so the transcript stays complete. Best-effort; a failure here must
      // not block the transcript itself.
      try {
        await archiveTicketAttachments(ticket.id);
      } catch (err) {
        console.error("Failed to archive ticket attachments:", err);
      }

      const token = randomBytes(24).toString("base64url");
      const messageCount = await countTicketMessages(ticket.id);
      await createTranscript({
        ticketId: ticket.id,
        guildId: ticket.guildId,
        token,
        closeReason: reason ?? null,
        messageCount,
      });
      url = transcriptUrl(token);
    } catch (err) {
      console.error("Failed to build transcript:", err);
    }
  }

  // Values available to the close DM / transcript-post templates.
  const closeVars = {
    ticket: String(ticket.number),
    number: String(ticket.number),
    server: guild.name,
    opener: `<@${ticket.openerId}>`,
    closer: `<@${closerId}>`,
    reason: reason ?? "",
    transcript_url: url ?? "",
  };

  // Post the transcript link before deleting the channel.
  if (url && config.transcriptChannelId) {
    const transcriptChannel = await guild.channels
      .fetch(config.transcriptChannelId)
      .catch(() => null);
    if (transcriptChannel?.isTextBased()) {
      const tmpl = pickTemplate(config.messageTemplates?.transcriptPost);
      const payload = tmpl
        ? renderTemplate(tmpl, closeVars)
        : {
            embeds: [buildCloseEmbed(guild, ticket, closerId, reason)],
            components: [linkButtonRow("View Online Transcript", url)],
          };
      await transcriptChannel
        .send({ ...payload, allowedMentions: { parse: [] } })
        .catch(() => {});
    }
  }

  // Optionally DM the opener their transcript link (best-effort: they may have
  // DMs disabled, or no longer share a server with the bot).
  if (url && config.dmTranscriptOnClose) {
    try {
      const opener = await guild.client.users.fetch(ticket.openerId);
      const tmpl = pickTemplate(config.messageTemplates?.closeDm);
      const payload = tmpl
        ? renderTemplate(tmpl, closeVars)
        : {
            embeds: [buildCloseEmbed(guild, ticket, closerId, reason)],
            components: [linkButtonRow("View Online Transcript", url)],
          };
      await opener.send(payload);
    } catch (err) {
      console.error("Failed to DM transcript to opener:", err);
    }
  }

  // Ask the opener to rate their experience, if enabled. A separate best-effort
  // DM, so it works whether or not the transcript DM is turned on.
  if (config.feedbackEnabled) {
    try {
      const opener = await guild.client.users.fetch(ticket.openerId);
      await opener.send(buildFeedbackPrompt(ticket, guild.name));
    } catch (err) {
      console.error("Failed to DM feedback prompt to opener:", err);
    }
  }

  await markTicketClosed(ticket.id, closerId);

  // An inactivity sweep closes as the bot; record that as automatic rather than
  // attributing it to whoever the bot's user happens to be.
  const autoClosed = closerId === guild.client.user?.id;
  await logAction(
    guild,
    config,
    `📪 Ticket #${ticket.number} closed by <@${closerId}>${reason ? ` — ${reason}` : ""}`,
    {
      audit: {
        action: autoClosed ? "system.auto_close" : "ticket.close",
        actorId: autoClosed ? null : closerId,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: { number: ticket.number, reason: reason ?? null },
      },
    },
  );

  if (channel && !channel.isThread() && channel.deletable) {
    await channel.delete(`Ticket #${ticket.number} closed`).catch(() => {});
  }
}

/**
 * Close a ticket via an interaction: authorize, acknowledge, then run the core
 * close routine.
 */
export async function closeTicket(
  interaction: Interaction,
  ticketId?: string,
  reason?: string,
): Promise<void> {
  const resolved = await resolveTicket(interaction, ticketId);
  if (!resolved) return;
  const { ticket, config } = resolved;
  const guild = interaction.guild!;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is already closed.");
    return;
  }
  if (!canManageTicket(interaction, config, ticket)) {
    await replyError(
      interaction,
      "Only the ticket opener or staff can close this ticket.",
    );
    return;
  }

  await interaction.reply({
    embeds: [
      noticeEmbed(
        reason ? `Closing this ticket: ${reason}` : "Closing this ticket…",
        EMBED_COLOR.danger,
      ),
    ],
  });

  await performClose(guild, ticket, config, interaction.user.id, reason);
}

/** Confirm / cancel buttons shown on a close request. */
function buildCloseRequestButtons(
  ticketId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_confirm:${ticketId}`)
      .setLabel("Confirm & close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`close_cancel:${ticketId}`)
      .setLabel("Keep open")
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * `/closerequest` — post a message asking another member to confirm closing the
 * ticket. Anyone but the requester can confirm; if `close_delay` hours are set,
 * the ticket auto-closes when the request goes unconfirmed for that long.
 */
export async function requestClose(
  interaction: ChatInputCommandInteraction,
  reason: string | undefined,
  closeDelayHours: number | undefined,
): Promise<void> {
  const resolved = await resolveTicket(interaction, undefined);
  if (!resolved) return;
  const { ticket, config } = resolved;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is already closed.");
    return;
  }

  const expiresAt = closeDelayHours
    ? new Date(Date.now() + closeDelayHours * 3_600_000)
    : null;
  await setCloseRequest(ticket.id, interaction.user.id, reason ?? null, expiresAt);

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR.info)
    .setTitle("Close request")
    .setDescription(
      `<@${interaction.user.id}> has requested to close this ticket.\n` +
        "Click **Confirm & close** below to close it" +
        (expiresAt
          ? `, otherwise it will auto-close <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.`
          : "."),
    );
  if (reason) embed.addFields({ name: "Reason", value: reason.slice(0, 1024) });

  // Ping the opener (usually the one expected to respond) unless they requested.
  const pingOpener = interaction.user.id !== ticket.openerId;

  await interaction.reply({
    content: pingOpener ? `<@${ticket.openerId}>` : undefined,
    embeds: [embed],
    components: [buildCloseRequestButtons(ticket.id)],
    allowedMentions: { users: pingOpener ? [ticket.openerId] : [] },
  });

  await logAction(
    interaction.guild!,
    config,
    `⏳ Close requested for ticket #${ticket.number} by <@${interaction.user.id}>${reason ? ` — ${reason}` : ""}`,
    {
      audit: {
        action: "ticket.close_request",
        actorId: interaction.user.id,
        actorName: interaction.user.username,
        targetType: "ticket",
        targetId: ticket.id,
        metadata: {
          number: ticket.number,
          reason: reason ?? null,
          expiresAt: expiresAt?.toISOString() ?? null,
        },
      },
    },
  );
}

/** Confirm a pending close request — must be a different user than requested. */
export async function confirmCloseRequest(
  interaction: ButtonInteraction,
  ticketId: string,
): Promise<void> {
  const resolved = await resolveTicket(interaction, ticketId);
  if (!resolved) return;
  const { ticket, config } = resolved;
  const guild = interaction.guild!;

  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is already closed.");
    return;
  }
  if (!ticket.closeRequestedBy) {
    await replyError(
      interaction,
      "There's no active close request for this ticket.",
    );
    return;
  }

  await interaction.reply({
    embeds: [
      noticeEmbed(
        `<@${interaction.user.id}> confirmed the close request. Closing…`,
        EMBED_COLOR.danger,
      ),
    ],
  });

  await performClose(
    guild,
    ticket,
    config,
    interaction.user.id,
    ticket.closeRequestReason ?? undefined,
  );
}

/** Cancel a pending close request (requester, opener, or staff). */
export async function cancelCloseRequest(
  interaction: ButtonInteraction,
  ticketId: string,
): Promise<void> {
  const resolved = await resolveTicket(interaction, ticketId);
  if (!resolved) return;
  const { ticket, config } = resolved;

  if (!ticket.closeRequestedBy) {
    await replyError(
      interaction,
      "There's no active close request for this ticket.",
    );
    return;
  }
  if (
    interaction.user.id !== ticket.closeRequestedBy &&
    !canManageTicket(interaction, config, ticket)
  ) {
    await replyError(interaction, "You can't cancel this close request.");
    return;
  }

  await clearCloseRequest(ticket.id);
  await interaction.update({
    embeds: [
      noticeEmbed(
        `Close request cancelled by <@${interaction.user.id}>.`,
        EMBED_COLOR.neutral,
      ),
    ],
    components: [],
  });
}

/**
 * Auto-close tickets whose close request has passed its delay unconfirmed.
 * Runs on a timer; the requester is recorded as the closer.
 */
export async function sweepDueCloseRequests(client: Client): Promise<void> {
  let due: Ticket[];
  try {
    due = await listDueCloseRequests();
  } catch (err) {
    console.error("Failed to list due close requests:", err);
    return;
  }

  for (const ticket of due) {
    try {
      const guild = await client.guilds.fetch(ticket.guildId).catch(() => null);
      const config = guild ? await getGuild(ticket.guildId) : null;
      if (!guild || !config) {
        await clearCloseRequest(ticket.id);
        continue;
      }
      await performClose(
        guild,
        ticket,
        config,
        ticket.closeRequestedBy ?? client.user!.id,
        ticket.closeRequestReason ?? undefined,
      );
    } catch (err) {
      console.error(`Auto-close failed for ticket ${ticket.id}:`, err);
    }
  }
}

const HOUR_MS = 3_600_000;

/**
 * Auto-close tickets that have gone quiet. For each open ticket in a guild with
 * inactivity auto-close enabled: if it's been silent past the threshold, close
 * it; otherwise, once it enters the warning window, post a one-time heads-up.
 * Any human reply resets the clock (see `markTicketActivity`). Claimed and
 * escalated tickets can be exempted per-guild. Runs on the same timer as the
 * close-request sweep.
 */
export async function sweepInactiveTickets(client: Client): Promise<void> {
  let candidates: Awaited<ReturnType<typeof listAutoCloseCandidates>>;
  try {
    candidates = await listAutoCloseCandidates();
  } catch (err) {
    console.error("Failed to list auto-close candidates:", err);
    return;
  }

  const now = Date.now();
  for (const {
    ticket,
    autoCloseHours,
    autoCloseWarningHours,
    autoCloseExcludeClaimed,
    autoCloseExcludeHighPriority,
  } of candidates) {
    try {
      if (autoCloseExcludeClaimed && ticket.claimedBy) continue;
      if (autoCloseExcludeHighPriority && isEscalatedPriority(ticket.priority))
        continue;

      const lastActivity = (ticket.lastActivityAt ?? ticket.openedAt).getTime();
      const inactiveMs = now - lastActivity;
      const thresholdMs = autoCloseHours * HOUR_MS;
      const warnLeadMs = autoCloseWarningHours * HOUR_MS;
      const willWarn = warnLeadMs > 0 && warnLeadMs < thresholdMs;

      if (inactiveMs >= thresholdMs) {
        const guild = await client.guilds
          .fetch(ticket.guildId)
          .catch(() => null);
        const config = guild ? await getGuild(ticket.guildId) : null;
        if (!guild || !config) continue;
        await performClose(
          guild,
          ticket,
          config,
          client.user!.id,
          "Auto-closed due to inactivity",
        );
      } else if (
        willWarn &&
        inactiveMs >= thresholdMs - warnLeadMs &&
        !ticket.autoCloseWarnedAt
      ) {
        const guild = await client.guilds
          .fetch(ticket.guildId)
          .catch(() => null);
        const channel = await guild?.channels
          .fetch(ticket.channelId)
          .catch(() => null);
        const closesAt = Math.floor((lastActivity + thresholdMs) / 1000);
        if (channel?.isTextBased()) {
          await channel
            .send({
              content: `<@${ticket.openerId}>`,
              embeds: [
                noticeEmbed(
                  `⏳ This ticket has been quiet for a while and will auto-close <t:${closesAt}:R> unless someone replies.`,
                  EMBED_COLOR.neutral,
                ),
              ],
              allowedMentions: { users: [ticket.openerId] },
            })
            .catch(() => {});
        }
        await markTicketAutoCloseWarned(ticket.id, new Date());
      }
    } catch (err) {
      console.error(`Inactivity auto-close failed for ${ticket.id}:`, err);
    }
  }
}
