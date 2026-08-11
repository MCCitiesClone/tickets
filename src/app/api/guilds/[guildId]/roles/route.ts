import { NextResponse } from "next/server";

import { fetchGuildRoles } from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import { getSession } from "@/lib/session";

/**
 * Returns a guild's assignable roles for building support/mention/access-control
 * pickers. Guarded: the caller must be signed in and able to manage the guild.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { guildId } = await params;
  if (!(await canManageGuild(guildId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const roles = await fetchGuildRoles(guildId);
  return NextResponse.json({ roles });
}
