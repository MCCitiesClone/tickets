import { describe, expect, it } from "vitest";

import type { FormQuestion } from "@/db/schema";
import { toPanelQuestion } from "./form-questions";

const row = (o: Partial<FormQuestion> = {}): FormQuestion =>
  ({
    id: "11111111-1111-1111-1111-111111111111",
    guildId: "g1",
    name: "Order number",
    label: "What's your order number?",
    style: "short",
    placeholder: null,
    required: true,
    options: [],
    multiple: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }) as FormQuestion;

describe("toPanelQuestion", () => {
  it("uses the library row's id as the modal field id", () => {
    // Stable across edits, and can't collide with a panel's inline q0…q4.
    expect(toPanelQuestion(row()).id).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });

  it("carries the member-facing label, not the library name", () => {
    const q = toPanelQuestion(row());
    expect(q.label).toBe("What's your order number?");
    expect(q.label).not.toBe("Order number");
  });

  it.each([
    { style: "short" },
    { style: "paragraph" },
  ])("keeps the $style text style", ({ style }) => {
    expect(toPanelQuestion(row({ style })).style).toBe(style);
  });

  it("falls back to short for an unrecognised style", () => {
    // The column is plain text, so a hand-edited row shouldn't break the modal.
    expect(toPanelQuestion(row({ style: "nonsense" })).style).toBe("short");
  });

  it("normalises a null placeholder to undefined", () => {
    expect(toPanelQuestion(row({ placeholder: null })).placeholder).toBeUndefined();
  });

  it("keeps a placeholder that is set", () => {
    expect(toPanelQuestion(row({ placeholder: "e.g. #1234" })).placeholder).toBe(
      "e.g. #1234",
    );
  });

  it("carries required through", () => {
    expect(toPanelQuestion(row({ required: false })).required).toBe(false);
  });

  it("builds a dropdown with its choices", () => {
    const q = toPanelQuestion(
      row({
        style: "select",
        multiple: true,
        options: [{ label: "Blue", value: "blue" }],
      }),
    );
    expect(q).toMatchObject({
      style: "select",
      multiple: true,
      options: [{ label: "Blue", value: "blue" }],
    });
  });

  it("does not carry choices onto a text question", () => {
    // The column always exists; only a dropdown should read it.
    const q = toPanelQuestion(
      row({ style: "short", options: [{ label: "Stale", value: "s" }] }),
    );
    expect(q).not.toHaveProperty("options");
  });
});
