import {
  type ButtonInteraction,
  type Interaction,
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";

import { commandMap } from "../commands";
import {
  claimTicket,
  closeTicket,
  openTicketFromPanel,
  submitTicketForm,
  unclaimTicket,
} from "../lib/tickets";

async function reportInteractionError(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  err: unknown,
  label: string,
) {
  console.error(`Error handling ${label}:`, err);
  const content = "Something went wrong handling that action.";
  // If we already deferred, edit that reply — otherwise it hangs on "thinking…".
  if (interaction.deferred) {
    await interaction.editReply({ content }).catch(() => {});
  } else if (!interaction.replied) {
    await interaction
      .reply({ content, flags: MessageFlags.Ephemeral })
      .catch(() => {});
  }
}

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
    const [action, id] = interaction.customId.split(":");
    try {
      if (action === "open_ticket") {
        await openTicketFromPanel(interaction, id);
      } else if (action === "close_ticket") {
        await closeTicket(interaction, id);
      } else if (action === "claim_ticket") {
        await claimTicket(interaction, id);
      } else if (action === "unclaim_ticket") {
        await unclaimTicket(interaction, id);
      }
    } catch (err) {
      await reportInteractionError(interaction, err, interaction.customId);
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const [action, id] = interaction.customId.split(":");
    try {
      if (action === "ticket_form") {
        await submitTicketForm(interaction, id);
      }
    } catch (err) {
      await reportInteractionError(interaction, err, interaction.customId);
    }
    return;
  }
}
