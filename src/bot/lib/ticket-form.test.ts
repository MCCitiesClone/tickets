import { describe, expect, it } from "vitest";
import { ComponentType } from "discord.js";
import type { ModalSubmitInteraction } from "discord.js";

import type { PanelQuestion } from "@/db/schema";
import { MAX_QUESTIONS, buildTicketModal, readAnswer } from "./ticket-form";

const panel = (title = "Support") => ({ id: "p1", title });

const text = (o: Partial<PanelQuestion> = {}): PanelQuestion =>
  ({ id: "q0", label: "Why?", style: "short", required: true, ...o }) as PanelQuestion;

const select = (o: Record<string, unknown> = {}): PanelQuestion =>
  ({
    id: "q1",
    label: "Which product?",
    style: "select",
    required: true,
    multiple: false,
    options: [
      { label: "Widget", value: "Widget" },
      { label: "Gadget", value: "Gadget" },
    ],
    ...o,
  }) as PanelQuestion;

/** The JSON discord.js will actually send. Asserts the modal isn't null. */
const json = (questions: PanelQuestion[], title?: string) =>
  buildTicketModal(panel(title), questions)!.toJSON() as unknown as {
    custom_id: string;
    title: string;
    components: {
      type: number;
      label: string;
      description?: string;
      component: Record<string, unknown>;
    }[];
  };

describe("buildTicketModal", () => {
  it("encodes the panel id so the submit handler can route it", () => {
    expect(json([text()]).custom_id).toBe("ticket_form:p1");
  });

  it("titles the modal with the panel, falling back when it's blank", () => {
    expect(json([text()], "Billing").title).toBe("Billing");
    expect(json([text()], "").title).toBe("Open a ticket");
  });

  it("truncates an over-long title to Discord's 45 characters", () => {
    expect(json([text()], "x".repeat(80)).title).toHaveLength(45);
  });

  it("wraps every field in a Label, not a bare action row", () => {
    // discord.js deprecates action rows in modals; Label is also the only
    // wrapper that accepts a select menu.
    const components = json([text(), select()]).components;
    expect(components.map((c) => c.type)).toEqual([
      ComponentType.Label,
      ComponentType.Label,
    ]);
  });

  it("builds a text question as a text input", () => {
    const [field] = json([text({ placeholder: "Briefly…" })]).components;
    expect(field.label).toBe("Why?");
    expect(field.component).toMatchObject({
      type: ComponentType.TextInput,
      custom_id: "q0",
      style: 1,
      required: true,
      placeholder: "Briefly…",
    });
  });

  it("uses the paragraph style for a paragraph question", () => {
    const [field] = json([text({ style: "paragraph" })]).components;
    expect(field.component.style).toBe(2);
  });

  it("builds a dropdown question as a string select", () => {
    const [field] = json([select()]).components;
    expect(field.component).toMatchObject({
      type: ComponentType.StringSelect,
      custom_id: "q1",
      min_values: 1,
      max_values: 1,
    });
    expect(field.component.options).toEqual([
      { label: "Widget", value: "Widget" },
      { label: "Gadget", value: "Gadget" },
    ]);
  });

  it("puts a dropdown's placeholder on the label as a description", () => {
    // A select has no placeholder of its own in this position.
    const [field] = json([select({ placeholder: "Pick one" })]).components;
    expect(field.description).toBe("Pick one");
  });

  it("allows every option to be picked when multiple is on", () => {
    const [field] = json([select({ multiple: true })]).components;
    expect(field.component.max_values).toBe(2);
  });

  it("lets an optional dropdown be left empty", () => {
    const [field] = json([select({ required: false })]).components;
    expect(field.component.min_values).toBe(0);
    expect(field.component.required).toBe(false);
  });

  it("returns null when a dropdown with no options was the only question", () => {
    // Discord rejects both a zero-option select and a zero-field modal, so
    // there is nothing valid to show — the caller opens the ticket directly.
    expect(buildTicketModal(panel(), [select({ options: [] })])).toBeNull();
  });

  it("keeps other questions when one dropdown is skipped", () => {
    const components = json([select({ options: [] }), text()]).components;
    expect(components).toHaveLength(1);
    expect(components[0].component.custom_id).toBe("q0");
  });

  it("caps a dropdown at Discord's 25 options", () => {
    const options = Array.from({ length: 40 }, (_, i) => ({
      label: `Option ${i}`,
      value: `o${i}`,
    }));
    const [field] = json([select({ options })]).components;
    expect(field.component.options).toHaveLength(25);
  });

  it("truncates option labels and descriptions to 100 characters", () => {
    const [field] = json([
      select({
        options: [
          { label: "x".repeat(200), value: "v", description: "y".repeat(200) },
        ],
      }),
    ]).components;
    const [option] = field.component.options as {
      label: string;
      description: string;
    }[];
    expect(option.label).toHaveLength(100);
    expect(option.description).toHaveLength(100);
  });

  it("truncates a field label to Discord's 45 characters", () => {
    const [field] = json([text({ label: "x".repeat(80) })]).components;
    expect(field.label).toHaveLength(45);
  });

  it("caps the modal at five fields", () => {
    const questions = Array.from({ length: 8 }, (_, i) =>
      text({ id: `q${i}`, label: `Q${i}` }),
    );
    expect(json(questions).components).toHaveLength(MAX_QUESTIONS);
  });

  it("returns null for a panel with no questions", () => {
    expect(buildTicketModal(panel(), [])).toBeNull();
  });
});

/** Minimal stand-in for the two field accessors `readAnswer` uses. */
function submission(values: {
  text?: Record<string, string>;
  selects?: Record<string, string[]>;
}): ModalSubmitInteraction {
  return {
    fields: {
      getTextInputValue: (id: string) => {
        if (!(id in (values.text ?? {}))) throw new Error("no such field");
        return values.text![id];
      },
      getStringSelectValues: (id: string) => {
        if (!(id in (values.selects ?? {}))) throw new Error("no such field");
        return values.selects![id];
      },
    },
  } as unknown as ModalSubmitInteraction;
}

describe("readAnswer", () => {
  it("reads a text answer", () => {
    expect(
      readAnswer(submission({ text: { q0: "my printer is on fire" } }), text()),
    ).toBe("my printer is on fire");
  });

  it("renders an empty text answer as an em dash", () => {
    expect(readAnswer(submission({ text: { q0: "" } }), text())).toBe("—");
  });

  it("reads a dropdown answer as the option's label, not its value", () => {
    // The transcript should read the way the member saw it.
    const question = select({
      options: [{ label: "Blue Widget", value: "wid-1" }],
    });
    expect(
      readAnswer(submission({ selects: { q1: ["wid-1"] } }), question),
    ).toBe("Blue Widget");
  });

  it("joins several chosen options", () => {
    expect(
      readAnswer(submission({ selects: { q1: ["Widget", "Gadget"] } }), select()),
    ).toBe("Widget, Gadget");
  });

  it("falls back to the raw value if the option has since been removed", () => {
    expect(
      readAnswer(submission({ selects: { q1: ["deleted"] } }), select()),
    ).toBe("deleted");
  });

  it("renders an unanswered optional dropdown as an em dash", () => {
    expect(readAnswer(submission({ selects: { q1: [] } }), select())).toBe("—");
  });

  it("survives a field missing from the submission entirely", () => {
    // An optional select the member never touched isn't submitted at all;
    // throwing here would fail the whole ticket open.
    expect(readAnswer(submission({}), select())).toBe("—");
    expect(readAnswer(submission({}), text())).toBe("—");
  });
});
