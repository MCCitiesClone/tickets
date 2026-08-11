import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { closeTicket } from "../lib/tickets";

/** `/close` — close the ticket in the current channel (opener or staff). */
export const closeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close the ticket in this channel.")
    .setDMPermission(false),
  async execute(interaction) {
    // Authorization + "is this a ticket channel?" are handled in closeTicket.
    await closeTicket(interaction);
  },
};
