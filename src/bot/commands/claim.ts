import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { claimTicket, unclaimTicket } from "../lib/tickets";

/** `/claim` — assign the current ticket to yourself (staff only). */
export const claimCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim the ticket in this channel.")
    .setDMPermission(false),
  async execute(interaction) {
    await claimTicket(interaction);
  },
};

/** `/unclaim` — release a ticket you claimed. */
export const unclaimCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unclaim")
    .setDescription("Release the ticket in this channel.")
    .setDMPermission(false),
  async execute(interaction) {
    await unclaimTicket(interaction);
  },
};
