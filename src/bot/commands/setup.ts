import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import type { Command } from "../types";
import { upsertGuild } from "../lib/guild-config";

/**
 * `/setup` — initialize this server's ticket configuration.
 *
 * This lightweight version ensures a guild config row exists and stores the
 * ticket category. Full configuration (staff roles, transcript/log channels,
 * welcome message, limits) is intended to be done from the web dashboard, or
 * expanded here later. Requires Manage Server.
 */
export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Initialize the tickets bot for this server.")
    .addChannelOption((opt) =>
      opt
        .setName("category")
        .setDescription("Category that new ticket channels are created under.")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false),
    )
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

    const category = interaction.options.getChannel("category");

    await upsertGuild(interaction.guildId, {
      ticketCategoryId: category?.id ?? null,
    });

    await interaction.reply({
      content: [
        "✅ Tickets bot initialized for this server.",
        category ? `Ticket category set to **${category.name}**.` : null,
        "Finish configuring staff roles, transcript channel and panels from the dashboard.",
        "",
        "_Note: opening/closing tickets is not wired up yet in this scaffold._",
      ]
        .filter(Boolean)
        .join("\n"),
      flags: MessageFlags.Ephemeral,
    });
  },
};
