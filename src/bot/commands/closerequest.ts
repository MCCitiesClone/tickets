import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { autocompleteCloseReason } from "../lib/close-reason-autocomplete";
import { requestClose } from "../lib/tickets";

/** `/closerequest` — ask another member to confirm closing this ticket. */
export const closeRequestCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("closerequest")
    .setDescription(
      "Sends a message asking the user to confirm the ticket is able to be closed.",
    )
    .addIntegerOption((o) =>
      o
        .setName("close_delay")
        .setDescription("Hours to close the ticket in if the user does not respond")
        .setMinValue(1)
        .setMaxValue(720)
        .setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("reason")
        .setDescription("The reason the ticket was closed")
        .setMaxLength(1000)
        .setAutocomplete(true)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const closeDelay = interaction.options.getInteger("close_delay") ?? undefined;
    const reason = interaction.options.getString("reason") ?? undefined;
    await requestClose(interaction, reason, closeDelay);
  },
  autocomplete: autocompleteCloseReason,
};
