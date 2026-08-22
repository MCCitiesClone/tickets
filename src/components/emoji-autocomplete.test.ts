import { describe, expect, it } from "vitest";

import { buildSuggestions, matchEmojiToken } from "./emoji-autocomplete";

const emojis = [
  { id: "1", name: "smile_cat", animated: false },
  { id: "2", name: "smirk", animated: false },
  { id: "3", name: "bigsmile", animated: false },
  { id: "4", name: "smi", animated: true },
];

describe("matchEmojiToken", () => {
  it.each([
    { input: "hello :smi", query: "smi", why: "after a space" },
    { input: ":smi", query: "smi", why: "at the start" },
    { input: "(:smi", query: "smi", why: "after an opening bracket" },
    { input: "[:smi", query: "smi", why: "after a bracket" },
    { input: "{:smi", query: "smi", why: "after a brace" },
    { input: "a, :smi", query: "smi", why: "after a comma and space" },
    { input: "line one\n:smi", query: "smi", why: "at the start of a line" },
    { input: "<:name:123> :ro", query: "ro", why: "after a complete mention" },
    { input: ":SMI", query: "SMI", why: "preserving case for the query" },
    { input: ":a_b-1", query: "a_b-1", why: "with underscores and digits" },
  ])("matches $why", ({ input, query }) => {
    expect(matchEmojiToken(input)?.query).toBe(query);
  });

  it.each([
    { input: ":a", why: "a single character is too short" },
    { input: "12:30", why: "a time is not a shortcode" },
    { input: "foo:bar", why: "a mid-word colon" },
    { input: "<:name", why: "a hand-written custom mention" },
    { input: "hello", why: "no colon at all" },
    { input: ":smi ", why: "the token was closed by a space" },
    { input: ":", why: "a bare colon" },
    { input: "", why: "empty input" },
    { input: "https://x.co", why: "a URL scheme" },
  ])("does not match: $why", ({ input }) => {
    expect(matchEmojiToken(input)).toBeNull();
  });

  it("reports a start offset that covers the whole token", () => {
    const text = "hello :smi";
    const token = matchEmojiToken(text)!;
    // The caller replaces [start, caret) — it must consume the colon too.
    expect(text.slice(token.start)).toBe(":smi");
  });

  it("reports the right offset at the very start of the text", () => {
    expect(matchEmojiToken(":smi")!.start).toBe(0);
  });
});

describe("buildSuggestions", () => {
  it("ranks custom emojis exact, then prefix, then substring", () => {
    const custom = buildSuggestions("smi", emojis)
      .filter((s) => s.key.startsWith("custom:"))
      .map((s) => s.name);
    expect(custom).toEqual(["smi", "smile_cat", "smirk", "bigsmile"]);
  });

  it("puts every custom emoji ahead of every unicode one", () => {
    const kinds = buildSuggestions("smi", emojis).map((s) =>
      s.key.split(":")[0],
    );
    expect(kinds.lastIndexOf("custom")).toBeLessThan(kinds.indexOf("unicode"));
  });

  it("inserts a custom emoji as a Discord mention", () => {
    const s = buildSuggestions("smirk", emojis)[0];
    expect(s.insert).toBe("<:smirk:2>");
  });

  it("uses the animated mention form for animated emojis", () => {
    const s = buildSuggestions("smi", emojis).find((x) => x.name === "smi")!;
    expect(s.insert).toBe("<a:smi:4>");
  });

  it("inserts a unicode emoji as its glyph", () => {
    const s = buildSuggestions("rocket", [])[0];
    expect(s.insert).toBe("🚀");
    expect(s.name).toBe("rocket");
  });

  it("still offers unicode when the server has no custom emojis", () => {
    expect(buildSuggestions("rocket", []).length).toBeGreaterThan(0);
  });

  it("matches custom emoji names case-insensitively", () => {
    expect(
      buildSuggestions("SMIRK", emojis).some((s) => s.name === "smirk"),
    ).toBe(true);
  });

  it("caps the list so the menu stays usable", () => {
    expect(buildSuggestions("a", emojis).length).toBeLessThanOrEqual(12);
  });

  it("returns nothing for a query that matches neither set", () => {
    expect(buildSuggestions("zzzzqqqq", emojis)).toEqual([]);
  });

  it("gives every suggestion a unique key", () => {
    const s = buildSuggestions("s", emojis);
    expect(new Set(s.map((x) => x.key)).size).toBe(s.length);
  });
});
