import {
  LabelBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

/**
 * Suggestion list for a ticket's close reason.
 *
 * Two sources: the guild's configured reasons, and reasons staff have actually
 * used recently. Configured ones come first — an admin curating the list should
 * see it win — and anything already configured is filtered out of the recent
 * half so a reason never appears twice.
 */

/** Discord shows at most 25 autocomplete choices. */
export const MAX_CLOSE_REASON_CHOICES = 25;

/** Discord caps a command option's value at 100 characters. */
const MAX_CHOICE_LENGTH = 100;

/** Merge configured and recently-used reasons into one deduplicated list. */
export function mergeCloseReasons(
  configured: string[],
  recent: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const reason of [...configured, ...recent]) {
    const trimmed = reason.trim();
    // Case-insensitive dedupe: "Resolved" and "resolved" are the same reason.
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Filter a suggestion list to what Discord should show for the partial text a
 * staff member has typed. Matches anywhere in the reason, not just the start,
 * since reasons read as sentences.
 */
export function filterCloseReasons(
  reasons: string[],
  query: string,
): { name: string; value: string }[] {
  const q = query.trim().toLowerCase();
  return reasons
    .filter((r) => !q || r.toLowerCase().includes(q))
    .slice(0, MAX_CLOSE_REASON_CHOICES)
    .map((r) => ({
      name: r.slice(0, MAX_CHOICE_LENGTH),
      value: r.slice(0, MAX_CHOICE_LENGTH),
    }));
}

/** Custom id of the saved-reason dropdown in the close-with-reason modal. */
export const CLOSE_REASON_SELECT_ID = "saved_reason";

/**
 * The close-with-reason modal.
 *
 * When the guild has suggested reasons, a dropdown of them sits above the free
 * text box, so the common cases are one click. The box stays either way —
 * picking nothing and typing is always allowed, and what's typed wins.
 */
export function buildCloseReasonModal(
  ticketId: string,
  suggestions: string[] = [],
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`close_reason_modal:${ticketId}`)
    .setTitle("Close ticket");

  if (suggestions.length > 0) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Saved reason")
        .setDescription("Optional — or type your own below")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(CLOSE_REASON_SELECT_ID)
            .setRequired(false)
            .setMinValues(0)
            .setMaxValues(1)
            .addOptions(
              suggestions.slice(0, MAX_CLOSE_REASON_CHOICES).map((reason) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(reason.slice(0, 100))
                  .setValue(reason.slice(0, 100)),
              ),
            ),
        ),
    );
  }

  return modal.addLabelComponents(
    new LabelBuilder()
      .setLabel("Reason")
      .setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("reason")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(1000),
      ),
  );
}

/**
 * The reason chosen in the close-with-reason modal: what was typed, else what
 * was picked from the dropdown. Typed text wins because someone who typed
 * clearly meant it.
 */
export function readCloseReasonModal(
  interaction: ModalSubmitInteraction,
): string | undefined {
  const typed = interaction.fields.getTextInputValue("reason")?.trim();
  if (typed) return typed;
  try {
    return interaction.fields.getStringSelectValues(CLOSE_REASON_SELECT_ID)[0];
  } catch {
    // No dropdown in the modal, or it was left untouched.
    return undefined;
  }
}
