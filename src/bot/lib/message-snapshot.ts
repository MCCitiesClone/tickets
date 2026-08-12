import type { Embed, Message } from "discord.js";

import type {
  NewTicketMessage,
  TranscriptEmbed,
  TranscriptMention,
} from "@/db/schema";

/** Author display name at send time (guild nickname wins, then global name). */
function authorTag(message: Message): string {
  return (
    message.member?.displayName ??
    message.author.displayName ??
    message.author.username
  );
}

/** Convert a discord.js embed into the cleaned subset the viewer renders. */
function toTranscriptEmbed(embed: Embed): TranscriptEmbed {
  const out: TranscriptEmbed = {};
  if (embed.title) out.title = embed.title;
  if (embed.description) out.description = embed.description;
  if (embed.url) out.url = embed.url;
  if (embed.color != null) out.color = embed.color;
  if (embed.author?.name) {
    out.author = {
      name: embed.author.name,
      iconUrl: embed.author.iconURL,
      url: embed.author.url,
    };
  }
  if (embed.fields.length) {
    out.fields = embed.fields.map((f) => ({
      name: f.name,
      value: f.value,
      inline: f.inline,
    }));
  }
  if (embed.image?.url) out.image = { url: embed.image.url };
  if (embed.thumbnail?.url) out.thumbnail = { url: embed.thumbnail.url };
  if (embed.footer?.text) {
    out.footer = { text: embed.footer.text, iconUrl: embed.footer.iconURL };
  }
  if (embed.timestamp) out.timestamp = embed.timestamp;
  return out;
}

/** Collect user/role/channel mentions so the viewer can render readable names. */
function toMentions(message: Message): TranscriptMention[] {
  const mentions: TranscriptMention[] = [];
  for (const user of message.mentions.users.values()) {
    mentions.push({ id: user.id, name: user.username, type: "user" });
  }
  for (const role of message.mentions.roles.values()) {
    mentions.push({ id: role.id, name: role.name, type: "role" });
  }
  for (const channel of message.mentions.channels.values()) {
    const name = "name" in channel && channel.name ? channel.name : channel.id;
    mentions.push({ id: channel.id, name, type: "channel" });
  }
  return mentions;
}

/**
 * Snapshot a Discord message into a `ticket_message` insert row. Used by both
 * the real-time `messageCreate` listener and the on-close history sweep, so the
 * two paths always capture identical shapes.
 */
export function messageToRow(
  message: Message,
  ticketId: string,
): NewTicketMessage {
  const avatar = (message.member ?? message.author).displayAvatarURL({
    size: 128,
  });

  return {
    ticketId,
    discordMessageId: message.id,
    authorId: message.author.id,
    authorTag: authorTag(message),
    authorAvatarUrl: avatar,
    authorBot: message.author.bot,
    content: message.content ?? "",
    attachments: [...message.attachments.values()].map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      contentType: a.contentType,
      width: a.width,
      height: a.height,
      size: a.size,
    })),
    embeds: message.embeds.map(toTranscriptEmbed),
    mentions: toMentions(message),
    replyToId: message.reference?.messageId ?? null,
    editedAt: message.editedAt,
    createdAt: message.createdAt,
  };
}
