import { describe, expect, it } from "vitest";

import type { MessageTemplate } from "@/db/schema";
import { renderTemplate } from "./message-template";

const NOW = new Date("2026-08-22T12:00:00Z");
const UNIX = Math.floor(NOW.getTime() / 1000);

describe("renderTemplate", () => {
  it("substitutes placeholders in content", () => {
    const { content } = renderTemplate(
      { content: "Hi {user}, ticket {ticket}", embeds: [] },
      { user: "<@1>", ticket: "42" },
    );
    expect(content).toBe("Hi <@1>, ticket 42");
  });

  it("drops content that renders empty", () => {
    expect(renderTemplate({ content: "", embeds: [] }, {}).content).toBeUndefined();
  });

  it("substitutes across every embed field", () => {
    const [embed] = renderTemplate(
      {
        embeds: [
          {
            title: "T {ticket}",
            description: "D {ticket}",
            author: { name: "A {ticket}" },
            footer: { text: "F {ticket}" },
            fields: [{ name: "n {ticket}", value: "v {ticket}" }],
          },
        ],
      } as MessageTemplate,
      { ticket: "42" },
    ).embeds;

    const data = embed.data;
    expect(data.title).toBe("T 42");
    expect(data.description).toBe("D 42");
    expect(data.author?.name).toBe("A 42");
    expect(data.footer?.text).toBe("F 42");
    expect(data.fields?.[0]).toMatchObject({ name: "n 42", value: "v 42" });
  });

  it("resolves date/time tokens without the caller supplying them", () => {
    const { content } = renderTemplate(
      { content: "closes {now:R}", embeds: [] },
      {},
      // renderTemplate takes no clock, so assert on the shape instead.
    );
    expect(content).toMatch(/^closes <t:\d+:R>$/);
  });

  it("skips an embed with nothing renderable", () => {
    expect(
      renderTemplate({ embeds: [{}, { color: 0x5865f2 }] } as MessageTemplate, {})
        .embeds,
    ).toHaveLength(0);
  });

  it("keeps an embed that only has fields", () => {
    expect(
      renderTemplate(
        { embeds: [{ fields: [{ name: "n", value: "v" }] }] } as MessageTemplate,
        {},
      ).embeds,
    ).toHaveLength(1);
  });

  it("clamps to Discord's limits", () => {
    const long = "x".repeat(5000);
    const { content, embeds } = renderTemplate(
      {
        content: long,
        embeds: Array.from({ length: 14 }, () => ({
          title: long,
          description: long,
          fields: Array.from({ length: 30 }, () => ({
            name: long,
            value: long,
          })),
        })),
      } as MessageTemplate,
      {},
    );

    expect(content).toHaveLength(2000);
    expect(embeds).toHaveLength(10);
    expect(embeds[0].data.title).toHaveLength(256);
    expect(embeds[0].data.description).toHaveLength(4096);
    expect(embeds[0].data.fields).toHaveLength(25);
    expect(embeds[0].data.fields?.[0].name).toHaveLength(256);
    expect(embeds[0].data.fields?.[0].value).toHaveLength(1024);
  });

  it("substitutes a field to a zero-width space rather than an empty string", () => {
    // Discord rejects an embed field with an empty name or value outright.
    const [embed] = renderTemplate(
      { embeds: [{ fields: [{ name: "{missing}", value: "" }] }] } as MessageTemplate,
      { missing: "" },
    ).embeds;
    expect(embed.data.fields?.[0].name).not.toBe("");
    expect(embed.data.fields?.[0].value).not.toBe("");
  });

  it("keeps a valid timestamp and ignores a malformed one", () => {
    const good = renderTemplate(
      { embeds: [{ title: "T", timestamp: NOW.toISOString() }] } as MessageTemplate,
      {},
    ).embeds[0];
    expect(Date.parse(good.data.timestamp!)).toBe(UNIX * 1000);

    const bad = renderTemplate(
      { embeds: [{ title: "T", timestamp: "not-a-date" }] } as MessageTemplate,
      {},
    ).embeds[0];
    expect(bad.data.timestamp).toBeUndefined();
  });

  it("defaults a field's inline flag to false", () => {
    const [embed] = renderTemplate(
      { embeds: [{ fields: [{ name: "n", value: "v" }] }] } as MessageTemplate,
      {},
    ).embeds;
    expect(embed.data.fields?.[0].inline).toBe(false);
  });

  it("renders an empty template to nothing at all", () => {
    expect(renderTemplate({ content: "", embeds: [] }, {})).toEqual({
      content: undefined,
      embeds: [],
    });
  });

  it("leaves a token the context doesn't provide as literal text", () => {
    expect(
      renderTemplate({ content: "Hi {nobody}", embeds: [] }, {}).content,
    ).toBe("Hi {nobody}");
  });
});
