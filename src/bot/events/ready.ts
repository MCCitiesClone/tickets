import type { Client } from "discord.js";

import { registerCommands } from "../lib/register-commands";
import { loadOpenTicketChannels } from "../lib/ticket-channels";

/**
 * Fired once when the gateway connection is ready. We (re)register slash
 * commands here so a freshly deployed bot always has up-to-date commands, and
 * warm the transcript-capture cache with every currently-open ticket channel.
 *
 * If `DISCORD_DEV_GUILD_ID` is set we register to that guild (instant updates
 * during development); otherwise we register globally.
 */
export async function onReady(client: Client<true>): Promise<void> {
  console.log(`Logged in as ${client.user.tag} (${client.user.id}).`);

  try {
    await registerCommands(process.env.DISCORD_DEV_GUILD_ID);
  } catch (err) {
    console.error("Failed to register commands on ready:", err);
  }

  try {
    const count = await loadOpenTicketChannels();
    console.log(`Tracking ${count} open ticket channel(s) for transcripts.`);
  } catch (err) {
    console.error("Failed to warm ticket-channel cache:", err);
  }
}
