import { REST, Routes } from "discord.js";

/**
 * Register all slash commands with Discord via the REST API.
 *
 * Pass a guild ID to register commands to a single guild (updates instantly —
 * ideal for development). With no guild ID, commands register globally (can
 * take up to an hour to propagate).
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

  const route = guildId
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, guildId)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  await rest.put(route, { body });
  console.log(
    `Registered ${body.length} command(s) ${
      guildId ? `to guild ${guildId}` : "globally"
    }.`,
  );
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
