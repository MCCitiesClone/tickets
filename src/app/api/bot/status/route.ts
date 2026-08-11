import { NextResponse } from "next/server";

import { fetchBotGuilds } from "@/lib/discord-api";
import { getSession } from "@/lib/session";

/**
 * Lightweight polling endpoint for the dashboard: reports how many servers the
 * bot is currently in. Used to detect when a user finishes the "Add to Discord"
 * flow. Requires a session (returns 401 rather than redirecting, since it's
 * fetched by client JS).
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const guilds = await fetchBotGuilds();
  return NextResponse.json({ botGuildCount: guilds.length });
}
