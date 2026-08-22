import { describe, expect, it } from "vitest";

import type { MessageTemplate } from "@/db/schema";
import { fromDiscordJson, toDiscordJson } from "./discord-json";

describe("fromDiscordJson", () => {
  it("reads content and a full embed", () => {
    const template = fromDiscordJson(
      JSON.stringify({
        content: "hello",
        embeds: [
          {
            title: "T",
            description: "D",
            url: "https://example.com",
            color: 5814783,
            author: { name: "A", icon_url: "https://example.com/a.png" },
            fields: [{ name: "n", value: "v", inline: true }],
            image: { url: "https://example.com/i.png" },
            thumbnail: { url: "https://example.com/t.png" },
            footer: { text: "F", icon_url: "https://example.com/f.png" },
            timestamp: "2026-08-22T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(template.content).toBe("hello");
    expect(template.embeds).toHaveLength(1);
    expect(template.embeds[0]).toMatchObject({
      title: "T",
      description: "D",
      color: 5814783,
      author: { name: "A", iconUrl: "https://example.com/a.png" },
      fields: [{ name: "n", value: "v", inline: true }],
      footer: { text: "F", iconUrl: "https://example.com/f.png" },
    });
  });

  it("accepts camelCase icon keys as well as Discord's snake_case", () => {
    // embed-generator emits snake_case; our own export used to emit camelCase.
    const t = fromDiscordJson(
      JSON.stringify({
        embeds: [
          {
            author: { name: "A", iconUrl: "https://example.com/a.png" },
            footer: { text: "F", iconUrl: "https://example.com/f.png" },
          },
        ],
      }),
    );
    expect(t.embeds[0].author?.iconUrl).toBe("https://example.com/a.png");
    expect(t.embeds[0].footer?.iconUrl).toBe("https://example.com/f.png");
  });

  it("parses a hex colour string into an integer", () => {
    const t = fromDiscordJson(
      JSON.stringify({ embeds: [{ color: "#5865F2" }] }),
    );
    expect(t.embeds[0].color).toBe(0x5865f2);
  });

  it("drops a colour it can't parse rather than storing NaN", () => {
    const t = fromDiscordJson(
      JSON.stringify({ embeds: [{ color: "#zzzzzz" }] }),
    );
    expect(t.embeds[0].color).toBeUndefined();
  });

  it("ignores an author or footer with no name/text", () => {
    const t = fromDiscordJson(
      JSON.stringify({
        embeds: [{ author: { icon_url: "x" }, footer: { icon_url: "x" } }],
      }),
    );
    expect(t.embeds[0].author).toBeUndefined();
    expect(t.embeds[0].footer).toBeUndefined();
  });

  it("clamps to Discord's 10 embeds and 25 fields", () => {
    const t = fromDiscordJson(
      JSON.stringify({
        embeds: Array.from({ length: 14 }, () => ({
          title: "T",
          fields: Array.from({ length: 30 }, () => ({ name: "n", value: "v" })),
        })),
      }),
    );
    expect(t.embeds).toHaveLength(10);
    expect(t.embeds[0].fields).toHaveLength(25);
  });

  it.each([
    { raw: "{}", why: "an empty object" },
    { raw: '{"embeds": null}', why: "a null embeds key" },
    { raw: '{"embeds": "nope"}', why: "a non-array embeds key" },
    { raw: "[]", why: "a top-level array" },
    { raw: '"a string"', why: "a bare string" },
  ])("survives $why", ({ raw }) => {
    const t = fromDiscordJson(raw);
    expect(t.embeds).toEqual([]);
    expect(t.content).toBeUndefined();
  });

  it("throws on input that isn't JSON at all, so the UI can report it", () => {
    expect(() => fromDiscordJson("not json")).toThrow();
  });

  it("coerces a malformed field to empty strings rather than dropping it", () => {
    const t = fromDiscordJson(
      JSON.stringify({ embeds: [{ fields: [{ name: 5 }] }] }),
    );
    expect(t.embeds[0].fields).toEqual([{ name: "", value: "", inline: false }]);
  });
});

describe("toDiscordJson", () => {
  it("emits snake_case icon keys", () => {
    const json = JSON.parse(
      toDiscordJson({
        embeds: [
          {
            author: { name: "A", iconUrl: "https://example.com/a.png" },
            footer: { text: "F", iconUrl: "https://example.com/f.png" },
          },
        ],
      } as MessageTemplate),
    );
    expect(json.embeds[0].author).toEqual({
      name: "A",
      icon_url: "https://example.com/a.png",
    });
    expect(json.embeds[0].footer).toEqual({
      text: "F",
      icon_url: "https://example.com/f.png",
    });
  });

  it("omits empty values instead of emitting nulls Discord would reject", () => {
    const json = JSON.parse(
      toDiscordJson({ content: "", embeds: [{ title: "T" }] }),
    );
    expect(json).not.toHaveProperty("content");
    expect(json.embeds[0]).toEqual({ title: "T" });
  });

  it("keeps a zero colour, which is a real value and not 'absent'", () => {
    const json = JSON.parse(toDiscordJson({ embeds: [{ color: 0 }] }));
    expect(json.embeds[0].color).toBe(0);
  });

  it("defaults a field's inline flag", () => {
    const json = JSON.parse(
      toDiscordJson({ embeds: [{ fields: [{ name: "n", value: "v" }] }] }),
    );
    expect(json.embeds[0].fields[0].inline).toBe(false);
  });

  it("always emits an embeds array, even when empty", () => {
    expect(JSON.parse(toDiscordJson({ content: "hi", embeds: [] }))).toEqual({
      content: "hi",
      embeds: [],
    });
  });
});

describe("round trip", () => {
  it("survives export then re-import unchanged", () => {
    const original: MessageTemplate = {
      content: "hello {user}",
      embeds: [
        {
          title: "T",
          description: "D",
          url: "https://example.com",
          color: 0x5865f2,
          author: { name: "A", iconUrl: "https://example.com/a.png", url: "https://example.com" },
          fields: [
            { name: "n1", value: "v1", inline: true },
            { name: "n2", value: "v2", inline: false },
          ],
          image: { url: "https://example.com/i.png" },
          thumbnail: { url: "https://example.com/t.png" },
          footer: { text: "F", iconUrl: "https://example.com/f.png" },
          timestamp: "2026-08-22T12:00:00.000Z",
        },
      ],
    };
    expect(fromDiscordJson(toDiscordJson(original))).toEqual(original);
  });
});
