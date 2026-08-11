import {
  ActionRowBuilder,
  AttachmentBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
  type Guild as DiscordGuild,
  type GuildTextBasedChannel,
  MessageFlags,
  type OverwriteResolvable,
  PermissionFlagsBits,
} from "discord.js";

import type { Guild, Ticket } from "@/db/schema";
import { getGuild, nextTicketNumber } from "@/lib/queries/guild";
import {
  countOpenTicketsForUser,
  createTicket,
  getTicket,
  getTicketByChannel,
  markTicketClosed,
  setTicketClaimedBy,
} from "@/lib/queries/tickets";

type Interaction = ButtonInteraction | ChatInputCommandInteraction;

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

/** Buttons shown on the ticket's opening message, reflecting claim state. */
function buildControls(
  ticketId: string,
  claimedBy: string | null,
): ActionRowBuilder<ButtonBuilder> {
  const claimButton = claimedBy
    ? new ButtonBuilder()
        .setCustomId(`unclaim_ticket:${ticketId}`)
        .setLabel("Release")
        .setEmoji("🙌")
        .setStyle(ButtonStyle.Secondary)
    : new ButtonBuilder()
        .setCustomId(`claim_ticket:${ticketId}`)
        .setLabel("Claim")
        .setEmoji("🙋")
        .setStyle(ButtonStyle.Success);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    claimButton,
    new ButtonBuilder()
      .setCustomId(`close_ticket:${ticketId}`)
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
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

/**
 * Open a ticket from a panel button click: validate config + limits, create a
 * private channel under the configured category with per-user/staff overwrites,
 * persist the ticket, and post a welcome message with Claim + Close buttons.
 */
export async function openTicket(
  interaction: ButtonInteraction,
  panelId: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guild, guildId, user } = interaction;

  const config = await getGuild(guildId);
  if (!config?.ticketCategoryId) {
    await replyError(
      interaction,
      "Tickets aren't fully configured on this server yet. Ask an admin to set a ticket category in the dashboard.",
    );
    return;
  }

  // Enforce the per-user open-ticket limit (0 = unlimited).
  if (config.ticketLimit > 0) {
    const open = await countOpenTicketsForUser(guildId, user.id);
    if (open >= config.ticketLimit) {
      await replyError(
        interaction,
        `You already have ${open} open ticket${open === 1 ? "" : "s"} (limit ${config.ticketLimit}).`,
      );
      return;
    }
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const number = await nextTicketNumber(guildId);

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: TICKET_MEMBER_PERMS },
    ...config.staffRoleIds.map((roleId) => ({
      id: roleId,
      allow: TICKET_MEMBER_PERMS,
    })),
  ];

  let channel;
  try {
    channel = await guild.channels.create({
      name: channelName(config.namingScheme, number, user.username),
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      permissionOverwrites: overwrites,
      topic: `Ticket #${number} · opened by ${user.tag} (${user.id})`,
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
    panelId,
  });

  const mentions = [
    `<@${user.id}>`,
    ...config.staffRoleIds.map((r) => `<@&${r}>`),
  ].join(" ");

  const embed = new EmbedBuilder()
    .setTitle(`Ticket #${number}`)
    .setDescription(config.welcomeMessage)
    .setColor(0x5865f2);

  await channel.send({
    content: mentions,
    embeds: [embed],
    components: [buildControls(ticket.id, null)],
  });

  await logAction(
    guild,
    config,
    `🎫 Ticket #${number} opened by <@${user.id}> — <#${channel.id}>`,
  );

  await interaction.editReply({
    content: `Your ticket is ready: <#${channel.id}>`,
  });
}

/** Resolve the ticket for an interaction (by id or current channel) + config. */
async function resolveTicket(
  interaction: Interaction,
  ticketId: string | undefined,
): Promise<{ ticket: Ticket; config: Guild } | null> {
  if (!interaction.inCachedGuild()) return null;
  const ticket = ticketId
    ? await getTicket(ticketId)
    : await getTicketByChannel(interaction.channelId);
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

  const notice = claim
    ? `🙋 <@${userId}> claimed this ticket.`
    : `🙌 <@${userId}> released this ticket.`;

  // Update the opening message's buttons when acting via them; otherwise post.
  if (interaction.isButton()) {
    await interaction
      .update({ components: [buildControls(ticket.id, claim ? userId : null)] })
      .catch(() => {});
    if (interaction.channel?.isSendable()) {
      await interaction.channel.send(notice).catch(() => {});
    }
  } else {
    await interaction.reply(notice);
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

/** Build a plain-text transcript from the channel's recent messages. */
async function buildTranscript(
  channel: GuildTextBasedChannel,
  ticket: Ticket,
  reason: string | undefined,
): Promise<Buffer> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()].reverse().map((m) => {
    const when = m.createdAt.toISOString();
    const content = m.content || (m.embeds.length ? "[embed]" : "");
    return `[${when}] ${m.author.tag}: ${content}`;
  });
  const header =
    `Transcript for ticket #${ticket.number} (${ticket.id})\n` +
    `Channel: #${channel.name}\n` +
    (reason ? `Close reason: ${reason}\n` : "") +
    `\n`;
  return Buffer.from(header + lines.join("\n"), "utf8");
}

/**
 * Close a ticket: authorize, capture a transcript to the configured transcript
 * channel, mark it closed in the DB, log it, and delete the ticket channel.
 */
export async function closeTicket(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
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

  // Post a transcript before deleting the channel.
  if (config.transcriptChannelId && channel?.isTextBased()) {
    try {
      const file = new AttachmentBuilder(
        await buildTranscript(channel as GuildTextBasedChannel, ticket, reason),
        { name: `ticket-${ticket.number}.txt` },
      );
      const transcriptChannel = await guild.channels
        .fetch(config.transcriptChannelId)
        .catch(() => null);
      if (transcriptChannel?.isTextBased()) {
        await transcriptChannel.send({
          content: `Ticket #${ticket.number} closed by <@${interaction.user.id}> (opened by <@${ticket.openerId}>).${reason ? `\nReason: ${reason}` : ""}`,
          files: [file],
          allowedMentions: { parse: [] },
        });
      }
    } catch (err) {
      console.error("Failed to post transcript:", err);
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
