import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import {
  fetchBotGuilds,
  fetchUserManageableGuildIds,
  type PartialGuild,
} from "@/lib/discord-api";
import { listGuilds } from "@/lib/queries/guild";

export type ManageableGuild = PartialGuild & { configured: boolean };

export type ManageableGuildsResult = {
  guilds: ManageableGuild[];
  /** True if we could reach Discord for both the bot's and the user's guilds. */
  ok: boolean;
  /** True if the bot is in at least one server at all. */
  botHasGuilds: boolean;
};

/** Get the signed-in user's Discord OAuth access token (refreshed if needed). */
const getUserDiscordToken = cache(async (): Promise<string | null> => {
  try {
    const result = await auth.api.getAccessToken({
      body: { providerId: "discord" },
      headers: await headers(),
    });
    return result?.accessToken ?? null;
  } catch (err) {
    console.error("[guild-access] getAccessToken failed:", err);
    return null;
  }
});

/**
 * Servers the signed-in user may configure: the intersection of the servers the
 * bot is in and the servers where the user is owner / has Manage Server. Each is
 * flagged with whether it already has a config row.
 */
export const getManageableGuilds = cache(
  async (): Promise<ManageableGuildsResult> => {
    const token = await getUserDiscordToken();
    const [{ guilds: botGuilds, ok: botOk }, userResult, configured] =
      await Promise.all([
        fetchBotGuilds(),
        token
          ? fetchUserManageableGuildIds(token)
          : Promise.resolve({ ids: new Set<string>(), ok: false }),
        listGuilds(),
      ]);

    const configuredIds = new Set(configured.map((g) => g.guildId));

    const guilds = botGuilds
      .filter((g) => userResult.ids.has(g.id))
      .map((g) => ({ ...g, configured: configuredIds.has(g.id) }));

    return {
      guilds,
      ok: botOk && userResult.ok,
      botHasGuilds: botGuilds.length > 0,
    };
  },
);

/**
 * Authorization guard for guild-scoped actions/pages: returns true only if the
 * signed-in user may manage `guildId` (bot present + user has Manage Server).
 */
export async function canManageGuild(guildId: string): Promise<boolean> {
  const { guilds } = await getManageableGuilds();
  return guilds.some((g) => g.id === guildId);
}
