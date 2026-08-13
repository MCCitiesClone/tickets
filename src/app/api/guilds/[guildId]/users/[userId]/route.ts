import { NextResponse } from "next/server";

import { fetchDiscordUser } from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import { getSession } from "@/lib/session";

/**
 * Resolve a Discord user ID to their display name + avatar, for pickers that
 * accept a pasted ID (e.g. the blacklist). Guarded: the caller must be signed in
 * and able to manage the guild.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string; userId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { guildId, userId } = await params;
  if (!(await canManageGuild(guildId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const user = await fetchDiscordUser(userId);
  return NextResponse.json({ user });
}
