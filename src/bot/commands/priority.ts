import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { TicketPriority } from "@/db/schema";
import { TICKET_PRIORITIES } from "@/lib/ticket-priority";
import type { Command } from "../types";
import { changeTicketPriority } from "../lib/tickets";

const CHOICES = TICKET_PRIORITIES.map((p) => ({
  name: `${p.emoji} ${p.label}`,
  value: p.value as string,
}));

/**
 * `/priority [level]` — set this ticket's triage priority (staff), or report it
 * when `level` is omitted. Most urgent last in the choice list so it reads
 * low → urgent, matching the enum.
 */
export const priorityCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("priority")
    .setDescription("Set or show this ticket's priority.")
    .addStringOption((o) =>
      o
        .setName("level")
        .setDescription("New priority. Omit to show the current one.")
        .addChoices(...CHOICES),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const level = interaction.options.getString("level") as TicketPriority | null;
    // Authorization + "is this a ticket?" are handled in changeTicketPriority.
    await changeTicketPriority(interaction, level);
  },
};
