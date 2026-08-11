import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";

/** A trivial health-check command — confirms the bot is online and responsive. */
export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check that the tickets bot is online."),
  async execute(interaction) {
    const sent = await interaction.reply({
      content: "Pinging…",
      withResponse: true,
    });
    const latency =
      (sent.resource?.message?.createdTimestamp ?? Date.now()) -
      interaction.createdTimestamp;
    await interaction.editReply(
      `Pong! Round-trip \`${latency}ms\`, gateway \`${Math.round(
        interaction.client.ws.ping,
      )}ms\`.`,
    );
  },
};
