import { cache } from "react";

import { env } from "@/lib/env";

const DISCORD_API = "https://discord.com/api/v10";

export type PartialGuild = { id: string; name: string };

export type BotGuildsResult = {
  /** Guilds the bot is a member of (empty if unreachable). */
  guilds: PartialGuild[];
  /** Whether the Discord API call succeeded. `false` means "unknown", not "0". */
  ok: boolean;
};

/**
 * Fetch the guilds the bot is currently a member of, using the bot token.
 *
 * Wrapped in React `cache()` so it runs at most once per request. Failures
 * resolve to `{ guilds: [], ok: false }` so callers can tell "Discord is
 * unreachable" apart from "the bot genuinely isn't in any server" and avoid
 * showing misleading checklist state.
 */
export const fetchBotGuilds = cache(async (): Promise<BotGuildsResult> => {
  try {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return { guilds: [], ok: false };
    const guilds = (await res.json()) as PartialGuild[];
    return { guilds, ok: true };
  } catch {
    return { guilds: [], ok: false };
  }
});
