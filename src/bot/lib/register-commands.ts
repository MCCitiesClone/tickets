import { REST, Routes } from "discord.js";

/**
 * Register all slash commands with Discord via the REST API.
 *
 * Pass a guild ID to register commands to a single guild (updates instantly —
 * ideal for development). With no guild ID, commands register globally (can
 * take up to an hour to propagate).
 *
 * Keeping autocomplete clean:
 * - The bulk-overwrite `PUT` replaces the ENTIRE command set for the target
 *   scope, so any command removed from our registry is deleted from Discord on
 *   the next registration (no stale commands linger).
 * - Cross-scope duplicates: a command registered globally ALSO shows up in every
 *   guild's autocomplete. When we register to a specific guild (dev flow), we
 *   therefore also clear the global set so commands don't appear twice. (Use a
 *   separate Discord application for dev vs prod so this never touches your
 *   production global commands.)
 *
 * Env must already be loaded (Next.js loads it for the web app; the bot entry
 * and the direct-run block below call `loadEnvConfig` first). Imports of `env`
 * and the command registry are deferred so importing this module has no side
 * effects until it's actually called.
 */
export async function registerCommands(guildId?: string): Promise<void> {
  const { env } = await import("@/lib/env");
  const { commands } = await import("../commands");

  const rest = new REST().setToken(env.DISCORD_TOKEN);
  const body = commands.map((c) => c.data.toJSON());

  const globalRoute = Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  if (guildId) {
    // Overwrite this guild's commands (removes any that are no longer defined).
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId), {
      body,
    });
    // Clear global commands so they don't duplicate the guild-scoped ones in
    // autocomplete. No-op if there were none.
    await rest.put(globalRoute, { body: [] });
    console.log(
      `Registered ${body.length} command(s) to guild ${guildId}; cleared global commands to avoid duplicates.`,
    );
    return;
  }

  // Global registration overwrites the global set (removes stale commands).
  await rest.put(globalRoute, { body });
  console.log(`Registered ${body.length} command(s) globally.`);
}

// Allow running directly: `aube run bot:register [guildId]`
if (process.argv[1]?.includes("register-commands")) {
  void (async () => {
    const { loadEnvConfig } = await import("@next/env");
    loadEnvConfig(process.cwd());
    const guildId = process.argv[2] || process.env.DISCORD_DEV_GUILD_ID;
    try {
      await registerCommands(guildId);
      process.exit(0);
    } catch (err) {
      console.error("Failed to register commands:", err);
      process.exit(1);
    }
  })();
}
