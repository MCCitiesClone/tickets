import { NextResponse } from "next/server";

import { fetchGuildEmojis } from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import { getSession } from "@/lib/session";

/**
 * A guild's custom emojis, for the panel emoji picker. Guarded: the caller must
 * be signed in and able to manage the guild.
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

  const emojis = await fetchGuildEmojis(guildId);
  return NextResponse.json({ emojis });
}
