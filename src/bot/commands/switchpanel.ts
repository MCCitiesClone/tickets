import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { listGuildPanels } from "@/lib/queries/panels";
import type { Command } from "../types";
import { switchTicketPanel } from "../lib/tickets";

/** `/switchpanel <panel>` — re-associate this ticket with another panel. Staff. */
export const switchPanelCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("switchpanel")
    .setDescription("Switch which panel this ticket belongs to.")
    .addStringOption((o) =>
      o
        .setName("panel")
        .setDescription("The panel to switch to")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async autocomplete(interaction) {
    if (!interaction.inGuild()) {
      await interaction.respond([]);
      return;
    }
    const focused = interaction.options.getFocused().toLowerCase();
    const panels = await listGuildPanels(interaction.guildId);
    const choices = panels
      .filter((p) => p.title.toLowerCase().includes(focused))
      .slice(0, 25)
      .map((p) => ({ name: p.title.slice(0, 100), value: p.id }));
    await interaction.respond(choices);
  },
  async execute(interaction) {
    const panelId = interaction.options.getString("panel", true);
    // Authorization + validation are handled in switchTicketPanel.
    await switchTicketPanel(interaction, panelId);
  },
};
