import { describe, expect, it } from "vitest";

import {
  DEFAULT_TICKET_PRIORITY,
  ESCALATED_PRIORITIES,
  TICKET_PRIORITIES,
  isEscalatedPriority,
  priorityLabel,
  priorityMeta,
} from "./ticket-priority";

describe("TICKET_PRIORITIES", () => {
  it("covers every enum value exactly once", () => {
    expect(TICKET_PRIORITIES.map((p) => p.value)).toEqual([
      "low",
      "normal",
      "high",
      "urgent",
    ]);
  });

  it("ranks ascending in listed order, so the list doubles as the sort order", () => {
    const ranks = TICKET_PRIORITIES.map((p) => p.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("gives every priority a distinct emoji and colour", () => {
    expect(new Set(TICKET_PRIORITIES.map((p) => p.emoji)).size).toBe(4);
    expect(new Set(TICKET_PRIORITIES.map((p) => p.embedColor)).size).toBe(4);
  });

  it("keeps every embed colour inside Discord's 24-bit range", () => {
    for (const p of TICKET_PRIORITIES) {
      expect(p.embedColor).toBeGreaterThanOrEqual(0);
      expect(p.embedColor).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe("priorityMeta", () => {
  it.each(TICKET_PRIORITIES.map((p) => p.value))("resolves %s", (value) => {
    expect(priorityMeta(value).value).toBe(value);
  });

  it.each([{ input: null }, { input: undefined }])(
    "falls back to the default for $input",
    ({ input }) => {
      expect(priorityMeta(input).value).toBe(DEFAULT_TICKET_PRIORITY);
    },
  );

  it("falls back for a value that isn't a priority at all", () => {
    // Rows written before the column existed, or a hand-edited database.
    expect(
      priorityMeta("bogus" as (typeof TICKET_PRIORITIES)[number]["value"]).value,
    ).toBe(DEFAULT_TICKET_PRIORITY);
  });
});

describe("isEscalatedPriority", () => {
  it.each([
    ["low", false],
    ["normal", false],
    ["high", true],
    ["urgent", true],
  ] as const)("%s -> %s", (priority, expected) => {
    expect(isEscalatedPriority(priority)).toBe(expected);
  });

  it("agrees with ESCALATED_PRIORITIES", () => {
    const derived = TICKET_PRIORITIES.filter((p) =>
      isEscalatedPriority(p.value),
    ).map((p) => p.value);
    expect(derived).toEqual([...ESCALATED_PRIORITIES]);
  });

  it("treats escalation as the top of the rank order", () => {
    // The auto-close exemption assumes "escalated" means "above normal".
    const normalRank = priorityMeta("normal").rank;
    for (const p of TICKET_PRIORITIES) {
      expect(isEscalatedPriority(p.value)).toBe(p.rank > normalRank);
    }
  });
});

describe("priorityLabel", () => {
  it("prefixes the label with its emoji", () => {
    expect(priorityLabel("urgent")).toBe("🔴 Urgent");
  });

  it("labels an unknown priority as the default", () => {
    expect(priorityLabel(null)).toBe("⚪ Normal");
  });
});
