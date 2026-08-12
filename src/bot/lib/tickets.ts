import { randomBytes } from "node:crypto";

import {
  ActionRowBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ChannelType,
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
} from "@/db/schema";
import { env } from "@/lib/env";
import { renderTemplate } from "./message-template";
import { getGuild, nextTicketNumber } from "@/lib/queries/guild";
import { getPanel, isOnCooldown, startCooldown } from "@/lib/queries/panels";
import {
  countOpenTicketsForUser,
  countTicketMessages,
  createTicket,
  createTranscript,
  getTicket,
  getTicketByChannel,
  markTicketClosed,
  setTicketClaimedBy,
  setTicketNotesThread,
  setTicketPanel,
  upsertTicketMessages,
} from "@/lib/queries/tickets";
import { messageToRow } from "./message-snapshot";
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

/** Permissions granted to a member with access to a ticket channel. */
const TICKET_MEMBER_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];

/** Turn a naming scheme into a valid Discord channel name. */
function channelName(scheme: string, number: number, username: string): string {
  return (
    scheme
      .replaceAll("{number}", String(number))
      .replaceAll("{username}", username)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || `ticket-${number}`
  );
}

async function replyError(interaction: Interaction, content: string) {
  const payload = { content, flags: MessageFlags.Ephemeral as const };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

/** Whether the interacting member is support staff (staff role or manager). */
function isStaff(interaction: Interaction, config: Guild): boolean {
  const member = interaction.inCachedGuild() ? interaction.member : null;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return config.staffRoleIds.some((r) => member.roles.cache.has(r));
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

/** Post an audit line to the configured log channel, if any (no pings). */
async function logAction(
  guild: DiscordGuild,
  config: Guild,
  content: string,
): Promise<void> {
  if (!config.logChannelId) return;
  const channel = await guild.channels
    .fetch(config.logChannelId)
    .catch(() => null);
  if (channel?.isTextBased()) {
    await channel
      .send({ content, allowedMentions: { parse: [] } })
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

  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName(scheme, number, user.username),
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: overwrites,
      topic: `Ticket #${number} · opened by ${user.tag} <@${user.id}>`,
    });
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
    content: `Your ticket is ready: <#${channel.id}>`,
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
    if (answerFields.length > 0) {
      if (rendered.embeds.length === 0) rendered.embeds.push(new EmbedBuilder());
      const target = rendered.embeds[0];
      const used = target.data.fields?.length ?? 0;
      target.addFields(answerFields.slice(0, Math.max(0, 25 - used)));
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
  );
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
          content: claim
            ? `🙋 <@${userId}> claimed this ticket.`
            : `🙌 <@${userId}> released this ticket.`,
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
      await interaction.reply(`➕ Added <@${targetId}> to the ticket.`);
    } else {
      await channel.permissionOverwrites.delete(targetId);
      await interaction.reply(`➖ Removed <@${targetId}> from the ticket.`);
    }
  } catch (err) {
    console.error("Failed to update ticket member:", err);
    await replyError(interaction, "I couldn't update that member's access.");
  }
}

/** Sanitize a staff-supplied prefix into a Discord-safe channel-name segment. */
function sanitizePrefix(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Rename a ticket channel's prefix while preserving its `-<number>` suffix, so
 * the ticket's identity is never lost (e.g. `/rename bug` on ticket 42 →
 * `bug-42`). Staff only.
 */
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
    await interaction.editReply(
      "I couldn't rename the channel. Check that my role can Manage Channels.",
    );
    return;
  }

  await interaction.editReply(`✏️ Renamed this ticket to **${newName}**.`);
  await logAction(
    interaction.guild!,
    config,
    `✏️ Ticket #${ticket.number} renamed to \`${newName}\` by <@${interaction.user.id}>`,
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

  await interaction.editReply(
    `🔀 Switched this ticket to the **${panel.title}** panel` +
      (renamedTo ? ` and renamed it to **${renamedTo}**.` : "."),
  );
  await logAction(
    interaction.guild!,
    config,
    `🔀 Ticket #${ticket.number} switched to panel "${panel.title}"` +
      (renamedTo ? ` (renamed to \`${renamedTo}\`)` : "") +
      ` by <@${interaction.user.id}>`,
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
      await interaction.editReply(`🗒️ Staff notes: <#${existing.id}>`);
      return;
    }
  }

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply("Couldn't access the ticket channel.");
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
    await interaction.editReply(
      "I couldn't create the notes thread. Check that I can Create Private Threads here.",
    );
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

  await interaction.editReply(
    `A notes thread has been created for this ticket: <#${thread.id}>`,
  );
  await logAction(
    guild,
    config,
    `Staff notes opened for ticket #${ticket.number} by <@${interaction.user.id}>`,
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
 * Close a ticket: authorize, sweep the full history into the DB, create a
 * shareable transcript and post its link to the configured transcript channel,
 * mark it closed, log it, and delete the ticket channel.
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
    content: reason ? `Closing this ticket: ${reason}` : "Closing this ticket…",
  });

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

  // Stop live capture before touching the channel, so the bulk message-delete
  // Discord fires when the channel is removed isn't recorded as user deletions.
  untrackTicketChannel(ticket.channelId);

  // Sweep the history, then create the shareable transcript record.
  let url: string | null = null;
  if (channel?.isTextBased()) {
    try {
      await captureChannelHistory(channel as GuildTextBasedChannel, ticket.id);
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
    closer: `<@${interaction.user.id}>`,
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
            content:
              `📄 Transcript for ticket #${ticket.number} — <${url}>\n` +
              `Closed by <@${interaction.user.id}> (opened by <@${ticket.openerId}>).` +
              (reason ? `\nReason: ${reason}` : ""),
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
            content:
              `Your ticket #${ticket.number} in **${guild.name}** was closed.` +
              (reason ? `\nReason: ${reason}` : "") +
              `\nTranscript: ${url}`,
          };
      await opener.send(payload);
    } catch (err) {
      console.error("Failed to DM transcript to opener:", err);
    }
  }

  await markTicketClosed(ticket.id, interaction.user.id);

  await logAction(
    guild,
    config,
    `📪 Ticket #${ticket.number} closed by <@${interaction.user.id}>${reason ? ` — ${reason}` : ""}`,
  );

  if (channel && !channel.isThread() && channel.deletable) {
    await channel.delete(`Ticket #${ticket.number} closed`).catch(() => {});
  }
}
