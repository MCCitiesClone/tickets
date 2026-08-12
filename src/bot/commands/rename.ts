import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { renameTicket } from "../lib/tickets";

/** `/rename <name>` — rename the ticket's prefix, keeping its number. Staff. */
export const renameCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("rename")
    .setDescription("Rename this ticket's prefix (keeps the ticket number).")
    .addStringOption((o) =>
      o
        .setName("name")
        .setDescription('New prefix, e.g. "bug" → bug-42')
        .setRequired(true)
        .setMaxLength(80),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const name = interaction.options.getString("name", true);
    // Authorization + "is this a ticket?" are handled in renameTicket.
    await renameTicket(interaction, name);
  },
};
