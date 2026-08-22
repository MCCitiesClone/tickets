import { describe, expect, it } from "vitest";

import { applyPlaceholders, resolveTimePlaceholder } from "./placeholders";

/** A fixed clock so every expectation is exact rather than approximate. */
const NOW = new Date("2026-08-22T12:00:00Z");
const UNIX = Math.floor(NOW.getTime() / 1000);

describe("resolveTimePlaceholder", () => {
  it.each([
    ["now", "f"],
    ["datetime", "f"],
    ["date", "d"],
    ["time", "t"],
  ])("%s defaults to the :%s style", (token, style) => {
    expect(resolveTimePlaceholder(token, NOW)).toBe(`<t:${UNIX}:${style}>`);
  });

  it.each(["t", "T", "d", "D", "f", "F", "R"])(
    "honours the :%s style",
    (style) => {
      expect(resolveTimePlaceholder(`now:${style}`, NOW)).toBe(
        `<t:${UNIX}:${style}>`,
      );
    },
  );

  it.each([
    ["now+90s", 90],
    ["now+30m", 1_800],
    ["now+24h", 86_400],
    ["now+7d", 604_800],
    ["now+2w", 1_209_600],
  ])("%s offsets forward", (token, seconds) => {
    expect(resolveTimePlaceholder(token, NOW)).toBe(`<t:${UNIX + seconds}:f>`);
  });

  it("offsets backwards", () => {
    expect(resolveTimePlaceholder("now-30m", NOW)).toBe(`<t:${UNIX - 1800}:f>`);
  });

  it("combines an offset with a style", () => {
    expect(resolveTimePlaceholder("now+24h:R", NOW)).toBe(
      `<t:${UNIX + 86_400}:R>`,
    );
  });

  it("keeps an alias's default style when offset", () => {
    expect(resolveTimePlaceholder("date+1d", NOW)).toBe(
      `<t:${UNIX + 86_400}:d>`,
    );
  });

  it("defaults to the real clock when none is given", () => {
    const before = Math.floor(Date.now() / 1000);
    const rendered = resolveTimePlaceholder("now");
    const at = Number(/^<t:(\d+):/.exec(rendered!)![1]);
    expect(at).toBeGreaterThanOrEqual(before);
  });

  it.each([
    { token: "ticket", why: "an ordinary variable name" },
    { token: "nowish", why: "a token that merely starts with a time name" },
    { token: "now:Z", why: "an undefined style" },
    { token: "now+5y", why: "an unsupported unit" },
    { token: "now+h", why: "an offset with no amount" },
    { token: "now 24h", why: "a space in the offset" },
    { token: "", why: "the empty token" },
  ])("declines '$token' — $why", ({ token }) => {
    expect(resolveTimePlaceholder(token, NOW)).toBeNull();
  });
});

describe("applyPlaceholders", () => {
  const vars = { ticket: "42", server: "My Guild" };

  it("substitutes caller variables", () => {
    expect(applyPlaceholders("Ticket {ticket} in {server}", vars, NOW)).toBe(
      "Ticket 42 in My Guild",
    );
  });

  it("mixes variables and time tokens", () => {
    expect(applyPlaceholders("#{ticket} opened {now:R}", vars, NOW)).toBe(
      `#42 opened <t:${UNIX}:R>`,
    );
  });

  it("resolves a token more than once", () => {
    expect(applyPlaceholders("{now:R} and {now:R}", vars, NOW)).toBe(
      `<t:${UNIX}:R> and <t:${UNIX}:R>`,
    );
  });

  it("lets caller variables shadow a time token", () => {
    expect(applyPlaceholders("{now}", { now: "OVERRIDE" }, NOW)).toBe(
      "OVERRIDE",
    );
  });

  it.each([
    { text: "Hi {nope}", why: "an unknown token" },
    { text: "a {two words} b", why: "braces around a phrase" },
    { text: "a {} b", why: "empty braces" },
    { text: '{"a": 1}', why: "JSON-looking text" },
    { text: "{{ticket}}", why: "doubled braces" },
  ])("leaves $why alone", ({ text }) => {
    // These would each be a silent data-loss bug if substitution were greedy.
    expect(applyPlaceholders(text, {}, NOW)).toBe(text);
  });

  it("passes undefined and empty input straight through", () => {
    expect(applyPlaceholders(undefined, vars, NOW)).toBeUndefined();
    expect(applyPlaceholders("", vars, NOW)).toBe("");
  });

  it("substitutes an empty variable value", () => {
    expect(applyPlaceholders("[{reason}]", { reason: "" }, NOW)).toBe("[]");
  });
});
