import { describe, expect, it } from "vitest";

import { formatDuration } from "./duration";

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [1, "1s"],
    [59, "59s"],
  ])("%is -> %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it.each([
    [60, "1m"],
    [90, "2m"], // rounds to the nearest minute
    [3_540, "59m"],
  ])("%is -> %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it.each([
    [3_600, "1h"],
    [3_660, "1h 1m"],
    [7_200, "2h"],
    [86_340, "23h 59m"],
  ])("%is -> %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it.each([
    [86_400, "1d"],
    [90_000, "1d 1h"],
    [604_800, "7d"],
  ])("%is -> %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it("drops a zero remainder rather than printing '2h 0m'", () => {
    expect(formatDuration(7_200)).toBe("2h");
    expect(formatDuration(172_800)).toBe("2d");
  });

  it.each([
    { input: null },
    { input: undefined },
    { input: NaN },
    { input: Infinity },
  ])("renders an em dash for $input", ({ input }) => {
    expect(formatDuration(input as number)).toBe("—");
  });

  it("clamps a negative duration to zero rather than printing '-5s'", () => {
    // Clock skew between two servers can produce a negative delta.
    expect(formatDuration(-5)).toBe("0s");
  });

  it("rounds fractional seconds", () => {
    expect(formatDuration(1.4)).toBe("1s");
    expect(formatDuration(1.6)).toBe("2s");
  });
});
