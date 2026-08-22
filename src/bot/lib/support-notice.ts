import { EmbedBuilder } from "discord.js";

import type { Guild } from "@/db/schema";
import {
  describeSchedule,
  isWithinSupportHours,
  nextOpeningAfter,
} from "@/lib/support-hours";
import { EMBED_COLOR } from "./embeds";

/**
 * The availability notice posted in a new ticket, or null when there's nothing
 * worth saying.
 *
 * Two independent things can produce one: an expected-response hint (shown
 * whenever it's set), and being outside the configured support hours. A server
 * with neither gets no notice at all — a ticket shouldn't gain a message just
 * because the feature exists.
 *
 * Times are rendered as Discord dynamic timestamps so the opener reads "opens in
 * 3 hours" in their own timezone rather than the support team's.
 */
export function buildSupportNotice(
  config: Guild,
  now: Date = new Date(),
): EmbedBuilder | null {
  const hint = config.supportResponseHint?.trim();
  const open = isWithinSupportHours(
    now,
    config.supportHours,
    config.supportTimezone,
  );

  if (open && !hint) return null;

  const lines: string[] = [];

  if (!open) {
    lines.push("🌙 **Support is outside its usual hours**, so a reply may take longer than normal.");

    const opensAt = nextOpeningAfter(
      now,
      config.supportHours,
      config.supportTimezone,
    );
    if (opensAt) {
      const unix = Math.floor(opensAt.getTime() / 1000);
      lines.push(`Support is next available <t:${unix}:R> (<t:${unix}:F>).`);
    }

    const schedule = describeSchedule(config.supportHours);
    if (schedule.length > 0) {
      lines.push(
        "",
        `**Usual hours** (${config.supportTimezone})`,
        ...schedule.map((line) => `• ${line}`),
      );
    }
  }

  if (hint) {
    // Blank line only when it follows the out-of-hours block.
    if (lines.length > 0) lines.push("");
    lines.push(`⏱️ ${hint}`);
  }

  return new EmbedBuilder()
    .setColor(open ? EMBED_COLOR.info : EMBED_COLOR.neutral)
    .setDescription(lines.join("\n").slice(0, 4096));
}
