import { EmbedBuilder } from "discord.js";

/** Accent colours for the bot's system embeds. */
export const EMBED_COLOR = {
  info: 0x5865f2,
  success: 0x57f287,
  neutral: 0x99aab5,
  danger: 0xed4245,
} as const;

/** A simple single-line notice embed (used for confirmations and errors). */
export function noticeEmbed(
  description: string,
  color: number = EMBED_COLOR.info,
): EmbedBuilder {
  return new EmbedBuilder().setColor(color).setDescription(description);
}
