import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import type { Command } from "../types";

/**
 * `/panel` — post a ticket panel (a message with an "Open Ticket" button) into
 * the current channel.
 *
 * STUB (scaffold): panel creation/persistence and the button that opens tickets
 * are not implemented yet. When built, this will read/create a `panel` row for
 * the guild, post the embed + button, and store the resulting `messageId` so
 * `interactionCreate` can route `open_ticket:<panelId>` button clicks. Requires
 * Manage Server.
 */
export const panelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Post a ticket panel in this channel. (Not yet implemented)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  async execute(interaction) {
    await interaction.reply({
      content:
        "🚧 Panels aren't implemented yet in this scaffold. Configure them from the dashboard once available.",
      flags: MessageFlags.Ephemeral,
    });
  },
};
