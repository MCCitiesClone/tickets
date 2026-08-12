import { loadEnvConfig } from "@next/env";

// IMPORTANT: load .env* BEFORE importing anything that reads/validates env
// (e.g. `@/lib/env`, `@/db`). The bot runs as its own Node process, so — unlike
// the web app — Next.js does not load env for us.
loadEnvConfig(process.cwd());

async function main() {
  const { Client, GatewayIntentBits, Events, Partials } = await import(
    "discord.js"
  );
  const { env } = await import("@/lib/env");
  const { onReady } = await import("./events/ready");
  const { onInteractionCreate } = await import("./events/interactionCreate");
  const { onMessageCreate } = await import("./events/messageCreate");
  const { onMessageUpdate } = await import("./events/messageUpdate");
  const { onMessageDelete } = await import("./events/messageDelete");

  const client = new Client({
    // Guilds drives the channel-based ticket flow; GuildMessages +
    // MessageContent (privileged) power transcript capture. Partials let us
    // still handle edits/deletes of messages that aren't in the cache.
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  client.once(Events.ClientReady, onReady);
  client.on(Events.InteractionCreate, onInteractionCreate);
  client.on(Events.MessageCreate, onMessageCreate);
  client.on(Events.MessageUpdate, onMessageUpdate);
  client.on(Events.MessageDelete, onMessageDelete);

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
