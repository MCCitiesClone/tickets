import { cache } from "react";

import { env } from "@/lib/env";

const DISCORD_API = "https://discord.com/api/v10";

type PartialGuild = { id: string; name: string };

/**
 * Fetch the guilds the bot is currently a member of, using the bot token.
 *
 * Wrapped in React `cache()` so it runs at most once per request even if
 * several server components ask for it. Failures (bad token, network, rate
 * limit) resolve to an empty list rather than crashing the page — callers treat
 * "unknown" as "not yet invited".
 */
export const fetchBotGuilds = cache(async (): Promise<PartialGuild[]> => {
  try {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as PartialGuild[];
  } catch {
    return [];
  }
});
