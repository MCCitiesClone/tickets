import { type Interaction, MessageFlags } from "discord.js";

import { commandMap } from "../commands";

/**
 * Central interaction router. Handles:
 *  - Chat-input (slash) commands → dispatched via the command registry.
 *  - Button clicks → routed by `customId`. The `open_ticket:<panelId>` button
 *    is the entry point for opening a ticket (STUB in this scaffold).
 */
export async function onInteractionCreate(
  interaction: Interaction,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error running /${interaction.commandName}:`, err);
      const reply = {
        content: "Something went wrong running that command.",
        flags: MessageFlags.Ephemeral as const,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const [action] = interaction.customId.split(":");

    if (action === "open_ticket") {
      // STUB (scaffold): the ticket-opening flow lives here. When implemented
      // it will: look up the guild config + panel, enforce the per-user ticket
      // limit, create a private channel under `guild.ticketCategoryId` with
      // permission overwrites for the opener + staff roles, insert a `ticket`
      // row, and post the welcome message. See docs/architecture.md.
      await interaction.reply({
        content:
          "🚧 Opening tickets isn't implemented yet in this scaffold, but your click was received!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }
}
