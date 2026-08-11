import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import type { Command } from "../types";

/**
 * `/panel` — a bridge to the dashboard, where panels are created and posted.
 * Panels (the button messages members click to open tickets) are managed in the
 * web UI; this just links there. Requires Manage Server.
 */
export const panelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Get a link to create ticket panels in the dashboard.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    const { env } = await import("@/lib/env");
    await interaction.reply({
      content: `Create and post ticket panels from the dashboard: ${env.BETTER_AUTH_URL}/dashboard/panels`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
