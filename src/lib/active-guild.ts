import { cookies } from "next/headers";

import { getManageableGuilds, type ManageableGuild } from "@/lib/guild-access";

export const ACTIVE_GUILD_COOKIE = "active_guild";

/**
 * Resolve the "active" guild for the current request: the one stored in the
 * cookie if the user can still manage it, otherwise the first manageable guild.
 * Returns the full manageable list too, for the switcher.
 */
export async function getActiveGuild(): Promise<{
  guilds: ManageableGuild[];
  active: ManageableGuild | null;
}> {
  const { guilds } = await getManageableGuilds();
  if (guilds.length === 0) return { guilds, active: null };

  const cookie = (await cookies()).get(ACTIVE_GUILD_COOKIE)?.value;
  const active = guilds.find((g) => g.id === cookie) ?? guilds[0];
  return { guilds, active };
}

/** Convenience: just the active guild's ID (or null if none manageable). */
export async function getActiveGuildId(): Promise<string | null> {
  const { active } = await getActiveGuild();
  return active?.id ?? null;
}
