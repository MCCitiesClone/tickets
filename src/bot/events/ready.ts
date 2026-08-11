import type { Client } from "discord.js";

import { registerCommands } from "../lib/register-commands";

/**
 * Fired once when the gateway connection is ready. We (re)register slash
 * commands here so a freshly deployed bot always has up-to-date commands.
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
}
