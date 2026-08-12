import {
  type ButtonInteraction,
  type Interaction,
  MessageFlags,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";

import { commandMap } from "../commands";
import { EMBED_COLOR, noticeEmbed } from "../lib/embeds";
import {
  buildCloseReasonModal,
  cancelCloseRequest,
  claimTicket,
  closeTicket,
  confirmCloseRequest,
  openTicketFromPanel,
  submitTicketForm,
  unclaimTicket,
} from "../lib/tickets";

async function reportInteractionError(
  interaction:
    | ButtonInteraction
    | ModalSubmitInteraction
    | StringSelectMenuInteraction,
  err: unknown,
  label: string,
) {
  console.error(`Error handling ${label}:`, err);
  const embeds = [
    noticeEmbed("Something went wrong handling that action.", EMBED_COLOR.danger),
  ];
  // If we already deferred, edit that reply — otherwise it hangs on "thinking…".
  if (interaction.deferred) {
    await interaction.editReply({ embeds }).catch(() => {});
  } else if (!interaction.replied) {
    await interaction
      .reply({ embeds, flags: MessageFlags.Ephemeral })
      .catch(() => {});
  }
}

/**
 * Reset a multi-panel dropdown to its placeholder after a selection.
 *
 * The select menu lives on a shared panel message, and Discord keeps the chosen
 * option highlighted (per viewer) until the message is re-rendered — which stops
 * the same option from emitting a fresh interaction when picked again. Re-editing
 * the message with its own components re-renders it, clearing the selection for
 * everyone (the serialized components carry no selection state). The reset is
 * idempotent, so concurrent opens racing to re-render the same message are
 * harmless. Best-effort: a failed reset must not break the open that already
 * succeeded.
 */
async function resetMultiPanelSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  try {
    await interaction.message.edit({
      components: interaction.message.components,
    });
  } catch (err) {
    console.error("Failed to reset multi-panel dropdown:", err);
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
        embeds: [
          noticeEmbed(
            "Something went wrong running that command.",
            EMBED_COLOR.danger,
          ),
        ],
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

  if (interaction.isAutocomplete()) {
    const command = commandMap.get(interaction.commandName);
    try {
      await command?.autocomplete?.(interaction);
    } catch (err) {
      console.error(`Error autocompleting /${interaction.commandName}:`, err);
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
      } else if (action === "close_reason") {
        await interaction.showModal(buildCloseReasonModal(id));
      } else if (action === "claim_ticket") {
        await claimTicket(interaction, id);
      } else if (action === "unclaim_ticket") {
        await unclaimTicket(interaction, id);
      } else if (action === "close_confirm") {
        await confirmCloseRequest(interaction, id);
      } else if (action === "close_cancel") {
        await cancelCloseRequest(interaction, id);
      }
    } catch (err) {
      await reportInteractionError(interaction, err, interaction.customId);
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const [action] = interaction.customId.split(":");
    try {
      if (action === "multipanel_select") {
        // The selected option's value is the chosen panel's id.
        const panelId = interaction.values[0];
        if (panelId) await openTicketFromPanel(interaction, panelId);
      }
    } catch (err) {
      await reportInteractionError(interaction, err, interaction.customId);
    } finally {
      // Clear the dropdown so the same ticket type can be picked again — Discord
      // otherwise keeps it stuck on the last selection. Runs whether the open
      // succeeded, was rejected by a precheck, or threw.
      if (action === "multipanel_select") {
        await resetMultiPanelSelect(interaction);
      }
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    const [action, id] = interaction.customId.split(":");
    try {
      if (action === "ticket_form") {
        await submitTicketForm(interaction, id);
      } else if (action === "close_reason_modal") {
        const reason =
          interaction.fields.getTextInputValue("reason") || undefined;
        await closeTicket(interaction, id, reason);
      }
    } catch (err) {
      await reportInteractionError(interaction, err, interaction.customId);
    }
    return;
  }
}
