import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { autocompleteCloseReason } from "../lib/close-reason-autocomplete";
import { closeTicket } from "../lib/tickets";

/** `/close [reason]` — close the ticket in the current channel (opener or staff). */
export const closeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close the ticket in this channel.")
    .addStringOption((o) =>
      o
        .setName("reason")
        .setDescription("Optional reason, saved to the transcript")
        .setMaxLength(1000)
        .setAutocomplete(true)
        .setRequired(false),
    )
    .setDMPermission(false),
  async execute(interaction) {
    const reason = interaction.options.getString("reason") ?? undefined;
    // Authorization + "is this a ticket channel?" are handled in closeTicket.
    await closeTicket(interaction, undefined, reason);
  },
  autocomplete: autocompleteCloseReason,
};
