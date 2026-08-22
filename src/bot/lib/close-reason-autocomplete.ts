import type { AutocompleteInteraction } from "discord.js";

import { getGuild } from "@/lib/queries/guild";
import { listRecentCloseReasons } from "@/lib/queries/tickets";
import { filterCloseReasons, mergeCloseReasons } from "./close-reasons";

/**
 * Shared autocomplete handler for the `reason` option on `/close` and
 * `/closerequest`.
 *
 * Best-effort by design: Discord gives an autocomplete three seconds, and a
 * failure here must degrade to "no suggestions" rather than leaving the field
 * spinning — staff can always type a reason freehand.
 */
export async function autocompleteCloseReason(
  interaction: AutocompleteInteraction,
): Promise<void> {
  if (!interaction.inGuild()) return;

  try {
    const [config, recent] = await Promise.all([
      getGuild(interaction.guildId),
      listRecentCloseReasons(interaction.guildId),
    ]);
    const reasons = mergeCloseReasons(config?.closeReasons ?? [], recent);
    const query = interaction.options.getFocused();
    await interaction.respond(filterCloseReasons(reasons, query));
  } catch (err) {
    console.error("Close-reason autocomplete failed:", err);
    await interaction.respond([]).catch(() => {});
  }
}
