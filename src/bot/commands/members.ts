import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { setTicketMember } from "../lib/tickets";

/** `/add` — grant a member access to the current ticket. */
export const addCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("add")
    .setDescription("Add a member to the current ticket.")
    .addUserOption((o) =>
      o.setName("user").setDescription("The member to add").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    await setTicketMember(interaction, user.id, true);
  },
};

/** `/remove` — revoke a member's access to the current ticket. */
export const removeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a member from the current ticket.")
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("The member to remove")
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async execute(interaction) {
    const user = interaction.options.getUser("user", true);
    await setTicketMember(interaction, user.id, false);
  },
};
