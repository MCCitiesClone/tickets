import {
  LabelBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

import {
  isSelectQuestion,
  MAX_QUESTION_OPTIONS,
  type Panel,
  type PanelQuestion,
} from "@/db/schema";

/**
 * Building the ticket form modal and reading its answers back.
 *
 * Kept apart from `tickets.ts` so the mapping from stored questions to Discord
 * components — the fiddly part, full of per-field limits — can be exercised
 * without a gateway connection or a database.
 */

/** Discord allows at most five fields in a modal. */
export const MAX_QUESTIONS = 5;

/**
 * Read one question's answer off a submitted modal, as display text.
 *
 * A dropdown yields the chosen options' **labels**, not their stored values —
 * the transcript should read the way the member saw it. Reading a field can
 * throw when it wasn't submitted (an optional select left untouched), so both
 * branches fall back to an em dash rather than failing the whole open.
 */
export function readAnswer(
  interaction: ModalSubmitInteraction,
  question: PanelQuestion,
): string {
  try {
    if (isSelectQuestion(question)) {
      const chosen = interaction.fields.getStringSelectValues(question.id);
      const labels = chosen.map(
        (value) =>
          question.options.find((o) => o.value === value)?.label ?? value,
      );
      return labels.join(", ") || "—";
    }
    return interaction.fields.getTextInputValue(question.id) || "—";
  } catch {
    return "—";
  }
}

/**
 * The modal for a panel's questions, or `null` when there's nothing to ask.
 *
 * Null rather than an empty modal because Discord rejects a modal with no
 * fields — which a panel whose only question is an optionless dropdown would
 * otherwise produce. The caller opens the ticket directly in that case.
 */
export function buildTicketModal(panel: Panel): ModalBuilder | null {
  const modal = new ModalBuilder()
    .setCustomId(`ticket_form:${panel.id}`)
    .setTitle(panel.title.slice(0, 45) || "Open a ticket");

  let fields = 0;

  // Every field goes inside a Label. discord.js deprecates bare action rows in
  // modals in favour of Label, and Label is the only wrapper that accepts a
  // select menu — so both question styles take the same path.
  for (const q of panel.questions.slice(0, MAX_QUESTIONS)) {
    const label = new LabelBuilder().setLabel(q.label.slice(0, 45));

    if (isSelectQuestion(q)) {
      if (q.options.length === 0) continue; // nothing to choose from
      if (q.placeholder) label.setDescription(q.placeholder.slice(0, 100));

      const options = q.options.slice(0, MAX_QUESTION_OPTIONS).map((o) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(o.label.slice(0, 100))
          .setValue(o.value.slice(0, 100));
        if (o.description) option.setDescription(o.description.slice(0, 100));
        return option;
      });

      label.setStringSelectMenuComponent(
        new StringSelectMenuBuilder()
          .setCustomId(q.id)
          .setRequired(q.required)
          .setMinValues(q.required ? 1 : 0)
          .setMaxValues(q.multiple ? options.length : 1)
          .addOptions(options),
      );
    } else {
      const input = new TextInputBuilder()
        .setCustomId(q.id)
        .setStyle(
          q.style === "paragraph"
            ? TextInputStyle.Paragraph
            : TextInputStyle.Short,
        )
        .setRequired(q.required);
      if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
      label.setTextInputComponent(input);
    }

    modal.addLabelComponents(label);
    fields++;
  }

  return fields > 0 ? modal : null;
}
