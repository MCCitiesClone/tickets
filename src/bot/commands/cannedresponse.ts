import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { listGuildCannedResponses } from "@/lib/queries/canned-responses";
import type { Command } from "../types";
import { sendCannedResponse } from "../lib/tickets";

/**
 * `/cannedresponse <name>` — post a saved canned response in the current
 * channel. Staff only; the name option autocompletes from the guild's responses
 * that the invoking member is allowed to use.
 */
export const cannedResponseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("cannedresponse")
    .setDescription("Post a saved canned response in this channel.")
    .addStringOption((o) =>
      o
        .setName("name")
        .setDescription("Which canned response to send")
        .setRequired(true)
        .setAutocomplete(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.respond([]);
      return;
    }
    const focused = interaction.options.getFocused().toLowerCase();
    const member = interaction.member;
    const isManager = member.permissions.has(
      PermissionFlagsBits.ManageChannels,
    );
    const responses = await listGuildCannedResponses(interaction.guildId);
    const choices = responses
      .filter((r) => {
        // Hide responses the member can't use.
        if (r.accessRoleIds.length > 0 && !isManager) {
          if (!r.accessRoleIds.some((id) => member.roles.cache.has(id))) {
            return false;
          }
        }
        return r.name.toLowerCase().includes(focused);
      })
      .slice(0, 25)
      .map((r) => ({ name: r.name.slice(0, 100), value: r.id }));
    await interaction.respond(choices);
  },
  async execute(interaction) {
    const id = interaction.options.getString("name", true);
    // Authorization + validation are handled in sendCannedResponse.
    await sendCannedResponse(interaction, id);
  },
};
