import { EmbedBuilder, type Message } from "discord.js";

import { EMBED_COLOR } from "./embeds";

/**
 * Snapshotting a reported message into the ticket that reports it.
 *
 * The content is copied into the ticket rather than only linked, because the
 * common reason to report something is that it shouldn't stay up — by the time
 * staff read the ticket the original may well be deleted. A jump link alone
 * would then point at nothing.
 */

/** What a report captures, independent of discord.js. */
export type ReportedMessage = {
  messageId: string;
  channelId: string;
  guildId: string;
  authorId: string;
  authorTag: string;
  content: string;
  /** File names only — the URLs expire, and the archive is for ticket channels. */
  attachmentNames: string[];
  /** How many embeds the message carried, which the quote can't reproduce. */
  embedCount: number;
  createdAt: Date;
};

/** Discord's embed description limit, shared with the quoted content. */
const MAX_QUOTE = 3000;

/** Pull the fields a report needs off a discord.js message. */
export function toReportedMessage(message: Message): ReportedMessage {
  return {
    messageId: message.id,
    channelId: message.channelId,
    guildId: message.guildId ?? "",
    authorId: message.author.id,
    authorTag:
      message.member?.displayName ??
      message.author.displayName ??
      message.author.username,
    content: message.content ?? "",
    attachmentNames: [...message.attachments.values()].map((a) => a.name),
    embedCount: message.embeds.length,
    createdAt: message.createdAt,
  };
}

/** Permalink to the original message. */
export function messageLink(report: ReportedMessage): string {
  return `https://discord.com/channels/${report.guildId}/${report.channelId}/${report.messageId}`;
}

/**
 * The embed posted into the ticket describing the reported message.
 *
 * Deliberately renders the author as a mention *and* their name at report time:
 * the mention is actionable for staff, the snapshotted name survives a rename.
 */
export function buildReportEmbed(report: ReportedMessage): EmbedBuilder {
  const sent = Math.floor(report.createdAt.getTime() / 1000);

  const lines = [
    `**Author:** <@${report.authorId}> (${report.authorTag}) \`${report.authorId}\``,
    `**Sent:** <t:${sent}:F> in <#${report.channelId}>`,
    `**Jump:** [original message](${messageLink(report)})`,
  ];

  if (report.content.trim()) {
    // Quoted so it can't be mistaken for the reporter's own words, and blockquote
    // markers survive multi-line content.
    const quoted = report.content
      .slice(0, MAX_QUOTE)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
    lines.push("", quoted);
    if (report.content.length > MAX_QUOTE) lines.push("-# *(truncated)*");
  } else {
    lines.push("", "-# *(no text content)*");
  }

  const extras: string[] = [];
  if (report.attachmentNames.length > 0) {
    extras.push(
      `📎 ${report.attachmentNames.length} attachment(s): ${report.attachmentNames.join(", ")}`,
    );
  }
  if (report.embedCount > 0) extras.push(`🖼️ ${report.embedCount} embed(s)`);
  if (extras.length > 0) lines.push("", ...extras.map((e) => `-# ${e}`));

  return new EmbedBuilder()
    .setTitle("🚩 Reported message")
    .setColor(EMBED_COLOR.danger)
    .setDescription(lines.join("\n").slice(0, 4096));
}

/** Encode a report reference into a customId segment, for the modal round trip. */
export function encodeReportRef(report: ReportedMessage): string {
  return `${report.channelId}:${report.messageId}`;
}
