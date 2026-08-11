import { loadEnvConfig } from "@next/env";

// IMPORTANT: load .env* BEFORE importing anything that reads/validates env
// (e.g. `@/lib/env`, `@/db`). The bot runs as its own Node process, so — unlike
// the web app — Next.js does not load env for us.
loadEnvConfig(process.cwd());

async function main() {
  const { Client, GatewayIntentBits, Events } = await import("discord.js");
  const { env } = await import("@/lib/env");
  const { onReady } = await import("./events/ready");
  const { onInteractionCreate } = await import("./events/interactionCreate");

  const client = new Client({
    // Guilds intent is all the channel-based ticket flow needs. Add
    // GuildMessages + MessageContent later for transcript capture.
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, onReady);
  client.on(Events.InteractionCreate, onInteractionCreate);

  client.on(Events.Error, (err) => console.error("Client error:", err));

  // Graceful shutdown so the gateway connection closes cleanly on restart.
  const shutdown = () => {
    console.log("Shutting down bot…");
    client.destroy().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error("Fatal error starting bot:", err);
  process.exit(1);
});
