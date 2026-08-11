import {
  ActionRowBuilder,
  AttachmentBuilder,
  type ButtonInteraction,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ChannelType,
  EmbedBuilder,
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
} from "@/lib/queries/tickets";

type Interaction = ButtonInteraction | ChatInputCommandInteraction;

/** Turn a naming scheme into a valid Discord channel name. */
function channelName(scheme: string, number: number, username: string): string {
  return scheme
    .replaceAll("{number}", String(number))
    .replaceAll("{username}", username)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    || `ticket-${number}`;
}

async function replyError(interaction: Interaction, content: string) {
  const payload = { content, flags: MessageFlags.Ephemeral as const };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

/**
 * Open a ticket from a panel button click: validate config + limits, create a
 * private channel under the configured category with per-user/staff overwrites,
 * persist the ticket, and post a welcome message with a Close button.
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
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    ...config.staffRoleIds.map((roleId) => ({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
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

  const closeButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`close_ticket:${ticket.id}`)
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
  );

  await channel.send({
    content: mentions,
    embeds: [embed],
    components: [closeButton],
  });

  await interaction.editReply({
    content: `Your ticket is ready: <#${channel.id}>`,
  });
}

/** Whether the member may close the ticket (opener, staff role, or manager). */
function canClose(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  config: Guild,
  ticket: Ticket,
): boolean {
  if (interaction.user.id === ticket.openerId) return true;
  const member = interaction.inCachedGuild() ? interaction.member : null;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return config.staffRoleIds.some((r) => member.roles.cache.has(r));
}

/** Build a plain-text transcript from the channel's recent messages. */
async function buildTranscript(
  channel: GuildTextBasedChannel,
  ticket: Ticket,
): Promise<Buffer> {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()]
    .reverse()
    .map((m) => {
      const when = m.createdAt.toISOString();
      const content = m.content || (m.embeds.length ? "[embed]" : "");
      return `[${when}] ${m.author.tag}: ${content}`;
    });
  const header = `Transcript for ticket #${ticket.number} (${ticket.id})\nChannel: #${channel.name}\n\n`;
  return Buffer.from(header + lines.join("\n"), "utf8");
}

/**
 * Close a ticket: authorize, capture a transcript to the configured transcript
 * channel, mark it closed in the DB, and delete the ticket channel.
 */
export async function closeTicket(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  ticketId?: string,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;
  const { guild, guildId, channelId } = interaction;

  const ticket = ticketId
    ? await getTicket(ticketId)
    : await getTicketByChannel(channelId);

  if (!ticket || ticket.guildId !== guildId) {
    await replyError(interaction, "This isn't a ticket channel.");
    return;
  }
  if (ticket.status === "closed") {
    await replyError(interaction, "This ticket is already closed.");
    return;
  }

  const config = await getGuild(guildId);
  if (!config) {
    await replyError(interaction, "This server isn't configured.");
    return;
  }
  if (!canClose(interaction, config, ticket)) {
    await replyError(
      interaction,
      "Only the ticket opener or staff can close this ticket.",
    );
    return;
  }

  await interaction.reply({ content: "Closing this ticket…" });

  const channel = await guild.channels
    .fetch(ticket.channelId)
    .catch(() => null);

  // Post a transcript before deleting the channel.
  if (config.transcriptChannelId && channel?.isTextBased()) {
    try {
      const file = new AttachmentBuilder(
        await buildTranscript(channel as GuildTextBasedChannel, ticket),
        { name: `ticket-${ticket.number}.txt` },
      );
      const logChannel = await guild.channels
        .fetch(config.transcriptChannelId)
        .catch(() => null);
      if (logChannel?.isTextBased()) {
        await logChannel.send({
          content: `Ticket #${ticket.number} closed by <@${interaction.user.id}> (opened by <@${ticket.openerId}>).`,
          files: [file],
        });
      }
    } catch (err) {
      console.error("Failed to post transcript:", err);
    }
  }

  await markTicketClosed(ticket.id, interaction.user.id);

  if (channel && !channel.isThread() && channel.deletable) {
    await channel.delete(`Ticket #${ticket.number} closed`).catch(() => {});
  }
}
