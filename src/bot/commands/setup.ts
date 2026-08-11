import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import type { Command } from "../types";

/**
 * `/setup` — a bridge to the web dashboard, where all configuration now lives.
 *
 * Configuration (ticket category, staff roles, transcript/log channels, welcome
 * message, limits) is done in the dashboard rather than through Discord, so this
 * command just hands the user a deep link to this server's settings page.
 * Requires Manage Server.
 */
export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Get a link to configure this server in the dashboard.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { env } = await import("@/lib/env");
    const url = `${env.BETTER_AUTH_URL}/dashboard/settings/${interaction.guildId}`;

    await interaction.reply({
      content: [
        "🎫 **Configure tickets in the dashboard**",
        `Head to ${url} to set this server's ticket category, staff roles, and more.`,
        "You'll sign in with Discord and need the **Manage Server** permission.",
      ].join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  },
};
