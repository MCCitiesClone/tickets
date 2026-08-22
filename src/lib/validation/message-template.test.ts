import { describe, expect, it } from "vitest";

import {
  guildMessageTemplatesSchema,
  messageTemplateSchema,
} from "./message-template";

describe("messageTemplateSchema", () => {
  it("accepts a minimal template", () => {
    expect(messageTemplateSchema.parse({ embeds: [] })).toEqual({ embeds: [] });
  });

  it("accepts a fully populated embed", () => {
    const template = {
      content: "hi",
      embeds: [
        {
          author: { name: "A", iconUrl: "https://x/a.png", url: "https://x" },
          title: "T",
          url: "https://x",
          description: "D",
          color: 0x5865f2,
          fields: [{ name: "n", value: "v", inline: true }],
          image: { url: "https://x/i.png" },
          thumbnail: { url: "https://x/t.png" },
          footer: { text: "F", iconUrl: "https://x/f.png" },
          timestamp: "2026-08-22T12:00:00.000Z",
        },
      ],
    };
    expect(messageTemplateSchema.parse(template)).toEqual(template);
  });

  it("requires the embeds array", () => {
    expect(messageTemplateSchema.safeParse({}).success).toBe(false);
  });

  it("keeps a partially-filled draft valid", () => {
    // The editor saves as you type, so half-built embeds must round-trip.
    expect(
      messageTemplateSchema.safeParse({ embeds: [{ title: "just a title" }] })
        .success,
    ).toBe(true);
    expect(messageTemplateSchema.safeParse({ embeds: [{}] }).success).toBe(true);
  });

  it.each([
    { field: "content", value: "x".repeat(4001), where: "the template" },
    { field: "title", value: "x".repeat(257), where: "an embed" },
    { field: "description", value: "x".repeat(4097), where: "an embed" },
  ])("rejects an over-long $field on $where", ({ field, value }) => {
    const input =
      field === "content"
        ? { content: value, embeds: [] }
        : { embeds: [{ [field]: value }] };
    expect(messageTemplateSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an over-long field name or value", () => {
    expect(
      messageTemplateSchema.safeParse({
        embeds: [{ fields: [{ name: "x".repeat(257), value: "v" }] }],
      }).success,
    ).toBe(false);
    expect(
      messageTemplateSchema.safeParse({
        embeds: [{ fields: [{ name: "n", value: "x".repeat(1025) }] }],
      }).success,
    ).toBe(false);
  });

  it("rejects an over-long footer", () => {
    expect(
      messageTemplateSchema.safeParse({
        embeds: [{ footer: { text: "x".repeat(2049) } }],
      }).success,
    ).toBe(false);
  });

  it("enforces Discord's 10-embed and 25-field caps", () => {
    expect(
      messageTemplateSchema.safeParse({
        embeds: Array.from({ length: 11 }, () => ({})),
      }).success,
    ).toBe(false);
    expect(
      messageTemplateSchema.safeParse({
        embeds: [
          { fields: Array.from({ length: 26 }, () => ({ name: "n", value: "v" })) },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts exactly the cap", () => {
    expect(
      messageTemplateSchema.safeParse({
        embeds: Array.from({ length: 10 }, () => ({
          fields: Array.from({ length: 25 }, () => ({ name: "n", value: "v" })),
        })),
      }).success,
    ).toBe(true);
  });

  it.each([
    { color: -1, why: "negative" },
    { color: 0x1000000, why: "above 24-bit white" },
    { color: 1.5, why: "fractional" },
  ])("rejects a $why colour", ({ color }) => {
    expect(messageTemplateSchema.safeParse({ embeds: [{ color }] }).success).toBe(
      false,
    );
  });

  it.each([{ color: 0 }, { color: 0xffffff }])(
    "accepts colour $color at the boundary",
    ({ color }) => {
      expect(
        messageTemplateSchema.safeParse({ embeds: [{ color }] }).success,
      ).toBe(true);
    },
  );

  it("requires both a field's name and value", () => {
    expect(
      messageTemplateSchema.safeParse({ embeds: [{ fields: [{ name: "n" }] }] })
        .success,
    ).toBe(false);
  });

  it("rejects wrong types outright", () => {
    expect(messageTemplateSchema.safeParse({ embeds: "nope" }).success).toBe(
      false,
    );
    expect(
      messageTemplateSchema.safeParse({ content: 5, embeds: [] }).success,
    ).toBe(false);
  });
});

describe("guildMessageTemplatesSchema", () => {
  it("accepts an empty object — no templates configured", () => {
    expect(guildMessageTemplatesSchema.parse({})).toEqual({});
  });

  it("accepts any subset of the four templates", () => {
    const input = { welcome: { embeds: [] }, closeDm: { content: "bye", embeds: [] } };
    expect(guildMessageTemplatesSchema.parse(input)).toEqual(input);
  });

  it("validates each template it does contain", () => {
    expect(
      guildMessageTemplatesSchema.safeParse({
        welcome: { embeds: [{ title: "x".repeat(257) }] },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown template key's malformed value", () => {
    expect(
      guildMessageTemplatesSchema.safeParse({ welcome: "nope" }).success,
    ).toBe(false);
  });
});
