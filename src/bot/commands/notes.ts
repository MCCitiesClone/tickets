import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { openStaffNotes } from "../lib/tickets";

/** `/notes` — open a private staff-only thread on the current ticket. Staff. */
export const notesCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("notes")
    .setDescription("Open a private staff-only notes thread for this ticket.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async execute(interaction) {
    // Authorization + "is this a ticket?" are handled in openStaffNotes.
    await openStaffNotes(interaction);
  },
};
