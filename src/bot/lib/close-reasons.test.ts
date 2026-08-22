import { describe, expect, it } from "vitest";

import {
  CLOSE_REASON_SELECT_ID,
  MAX_CLOSE_REASON_CHOICES,
  buildCloseReasonModal,
  filterCloseReasons,
  mergeCloseReasons,
  readCloseReasonModal,
} from "./close-reasons";

describe("mergeCloseReasons", () => {
  it("puts configured reasons ahead of recently-used ones", () => {
    // An admin curating the list should see their order win.
    expect(mergeCloseReasons(["Resolved"], ["Duplicate"])).toEqual([
      "Resolved",
      "Duplicate",
    ]);
  });

  it("keeps the configured order", () => {
    expect(mergeCloseReasons(["B", "A", "C"], [])).toEqual(["B", "A", "C"]);
  });

  it("drops a recent reason already configured", () => {
    expect(mergeCloseReasons(["Resolved"], ["Resolved", "Spam"])).toEqual([
      "Resolved",
      "Spam",
    ]);
  });

  it("deduplicates case-insensitively", () => {
    // "Resolved" and "resolved" are the same reason to a human.
    expect(mergeCloseReasons(["Resolved"], ["resolved", "RESOLVED"])).toEqual([
      "Resolved",
    ]);
  });

  it("trims surrounding whitespace", () => {
    expect(mergeCloseReasons(["  Resolved  "], [])).toEqual(["Resolved"]);
  });

  it("drops blank entries", () => {
    expect(mergeCloseReasons(["", "   ", "Resolved"], ["\t"])).toEqual([
      "Resolved",
    ]);
  });

  it("returns nothing when both sources are empty", () => {
    expect(mergeCloseReasons([], [])).toEqual([]);
  });

  it("works with only recent reasons — no configuration required", () => {
    expect(mergeCloseReasons([], ["Duplicate"])).toEqual(["Duplicate"]);
  });
});

describe("filterCloseReasons", () => {
  const reasons = ["Resolved", "Duplicate report", "No response from user"];

  it("returns everything for an empty query", () => {
    expect(filterCloseReasons(reasons, "")).toHaveLength(3);
  });

  it("ignores a whitespace-only query", () => {
    expect(filterCloseReasons(reasons, "   ")).toHaveLength(3);
  });

  it("matches anywhere in the reason, not just the start", () => {
    // Reasons read as sentences, so prefix-only matching would be useless.
    expect(filterCloseReasons(reasons, "response")).toEqual([
      { name: "No response from user", value: "No response from user" },
    ]);
  });

  it("matches case-insensitively", () => {
    expect(filterCloseReasons(reasons, "RESOLVED")).toHaveLength(1);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterCloseReasons(reasons, "zzz")).toEqual([]);
  });

  it("uses the reason as both the label and the submitted value", () => {
    expect(filterCloseReasons(["Resolved"], "")).toEqual([
      { name: "Resolved", value: "Resolved" },
    ]);
  });

  it("caps at Discord's 25 choices", () => {
    const many = Array.from({ length: 40 }, (_, i) => `Reason ${i}`);
    expect(filterCloseReasons(many, "")).toHaveLength(MAX_CLOSE_REASON_CHOICES);
  });

  it("truncates a reason to Discord's 100-character option limit", () => {
    const [choice] = filterCloseReasons(["x".repeat(300)], "");
    expect(choice.name).toHaveLength(100);
    expect(choice.value).toHaveLength(100);
  });
});

describe("buildCloseReasonModal", () => {
  const json = (suggestions?: string[]) =>
    buildCloseReasonModal("t1", suggestions).toJSON() as unknown as {
      custom_id: string;
      components: {
        label: string;
        description?: string;
        component: Record<string, unknown>;
      }[];
    };

  it("encodes the ticket id so the submit handler can route it", () => {
    expect(json().custom_id).toBe("close_reason_modal:t1");
  });

  it("is just the text box when the guild has no suggestions", () => {
    const { components } = json([]);
    expect(components).toHaveLength(1);
    expect(components[0].component).toMatchObject({
      custom_id: "reason",
      style: 2,
      required: false,
      max_length: 1000,
    });
  });

  it("puts a dropdown above the text box when there are suggestions", () => {
    const { components } = json(["Resolved", "Spam"]);
    expect(components).toHaveLength(2);
    expect(components[0].component.custom_id).toBe(CLOSE_REASON_SELECT_ID);
    expect(components[1].component.custom_id).toBe("reason");
  });

  it("leaves the dropdown optional, so typing instead is allowed", () => {
    const [dropdown] = json(["Resolved"]).components;
    expect(dropdown.component).toMatchObject({
      required: false,
      min_values: 0,
      max_values: 1,
    });
  });

  it("offers each suggestion as one option", () => {
    const [dropdown] = json(["Resolved", "Spam"]).components;
    expect(dropdown.component.options).toEqual([
      { label: "Resolved", value: "Resolved" },
      { label: "Spam", value: "Spam" },
    ]);
  });

  it("caps the dropdown at Discord's 25 options", () => {
    const many = Array.from({ length: 40 }, (_, i) => `Reason ${i}`);
    const [dropdown] = json(many).components;
    expect(dropdown.component.options).toHaveLength(MAX_CLOSE_REASON_CHOICES);
  });

  it("truncates a long suggestion to Discord's option limit", () => {
    const [dropdown] = json(["x".repeat(300)]).components;
    const [option] = dropdown.component.options as { label: string }[];
    expect(option.label).toHaveLength(100);
  });

  it("keeps the text box even when suggestions exist", () => {
    // A reason that isn't on the list must still be possible.
    expect(json(["Resolved"]).components[1].component.custom_id).toBe("reason");
  });
});

/** Stand-in for the two field accessors `readCloseReasonModal` uses. */
function submission(fields: { typed?: string; picked?: string[] }) {
  return {
    fields: {
      getTextInputValue: () => fields.typed ?? "",
      getStringSelectValues: () => {
        if (!fields.picked) throw new Error("no such field");
        return fields.picked;
      },
    },
  } as unknown as Parameters<typeof readCloseReasonModal>[0];
}

describe("readCloseReasonModal", () => {
  it("uses what was typed", () => {
    expect(readCloseReasonModal(submission({ typed: "Fixed it" }))).toBe(
      "Fixed it",
    );
  });

  it("uses the picked suggestion when nothing was typed", () => {
    expect(
      readCloseReasonModal(submission({ typed: "", picked: ["Resolved"] })),
    ).toBe("Resolved");
  });

  it("prefers typed text over a picked suggestion", () => {
    // Someone who typed clearly meant it.
    expect(
      readCloseReasonModal(
        submission({ typed: "Actually a duplicate", picked: ["Resolved"] }),
      ),
    ).toBe("Actually a duplicate");
  });

  it("trims the typed reason", () => {
    expect(readCloseReasonModal(submission({ typed: "  Fixed  " }))).toBe(
      "Fixed",
    );
  });

  it("treats whitespace-only typing as nothing typed", () => {
    expect(
      readCloseReasonModal(submission({ typed: "   ", picked: ["Resolved"] })),
    ).toBe("Resolved");
  });

  it("returns undefined when neither was given", () => {
    expect(
      readCloseReasonModal(submission({ typed: "", picked: [] })),
    ).toBeUndefined();
  });

  it("returns undefined when the modal had no dropdown at all", () => {
    // Reading an absent field throws; a close with no reason is valid.
    expect(readCloseReasonModal(submission({ typed: "" }))).toBeUndefined();
  });
});
