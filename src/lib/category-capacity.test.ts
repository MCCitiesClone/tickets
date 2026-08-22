import { describe, expect, it } from "vitest";

import {
  CATEGORY_CHANNEL_LIMIT,
  CATEGORY_WARN_AT,
  CATEGORY_WARN_REMAINING,
  categoryCapacityLevel,
  categoryRemaining,
} from "./category-capacity";

describe("constants", () => {
  it("pins Discord's documented per-category cap", () => {
    expect(CATEGORY_CHANNEL_LIMIT).toBe(50);
  });

  it("derives the warn threshold from the remaining-slot budget", () => {
    expect(CATEGORY_WARN_AT).toBe(
      CATEGORY_CHANNEL_LIMIT - CATEGORY_WARN_REMAINING,
    );
    // A threshold at or above the cap would make the warning useless — it would
    // only ever fire once the category was already full.
    expect(CATEGORY_WARN_AT).toBeLessThan(CATEGORY_CHANNEL_LIMIT);
  });
});

describe("categoryRemaining", () => {
  it.each([
    [0, 50],
    [45, 5],
    [49, 1],
    [50, 0],
  ])("%i used -> %i free", (used, free) => {
    expect(categoryRemaining(used)).toBe(free);
  });

  it("never reports negative capacity when a category is over the cap", () => {
    // Discord's cap can be exceeded by channels created before it applied.
    expect(categoryRemaining(53)).toBe(0);
  });
});

describe("categoryCapacityLevel", () => {
  it.each([
    [0, "ok"],
    [44, "ok"],
    [45, "warning"],
    [49, "warning"],
    [50, "full"],
    [53, "full"],
  ] as const)("%i channels -> %s", (used, level) => {
    expect(categoryCapacityLevel(used)).toBe(level);
  });

  it("changes level exactly at the two boundaries and nowhere else", () => {
    const transitions: number[] = [];
    for (let n = 1; n <= 60; n++) {
      if (categoryCapacityLevel(n) !== categoryCapacityLevel(n - 1)) {
        transitions.push(n);
      }
    }
    expect(transitions).toEqual([CATEGORY_WARN_AT, CATEGORY_CHANNEL_LIMIT]);
  });
});
