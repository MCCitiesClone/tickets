import { describe, expect, it } from "vitest";

import type { MessageTemplate } from "@/db/schema";
import { renderTemplateToJson } from "./message-embed";

describe("renderTemplateToJson", () => {
  it("renders content and a full embed in Discord's snake_case shape", () => {
    const { content, embeds } = renderTemplateToJson({
      content: "hello",
      embeds: [
        {
          title: "T",
          description: "D",
          url: "https://example.com",
          color: 0x5865f2,
          author: { name: "A", iconUrl: "https://example.com/a.png" },
          fields: [{ name: "n", value: "v", inline: true }],
          image: { url: "https://example.com/i.png" },
          thumbnail: { url: "https://example.com/t.png" },
          footer: { text: "F", iconUrl: "https://example.com/f.png" },
        },
      ],
    });

    expect(content).toBe("hello");
    expect(embeds[0]).toMatchObject({
      title: "T",
      description: "D",
      color: 0x5865f2,
      author: { name: "A", icon_url: "https://example.com/a.png" },
      fields: [{ name: "n", value: "v", inline: true }],
      footer: { text: "F", icon_url: "https://example.com/f.png" },
    });
  });

  it("leaves {placeholder} tokens alone — these messages are static", () => {
    // Multi-panel messages are posted once, not rendered per ticket.
    expect(
      renderTemplateToJson({ content: "hi {user}", embeds: [] }).content,
    ).toBe("hi {user}");
  });

  it("drops empty content rather than sending an empty string", () => {
    expect(
      renderTemplateToJson({ content: "", embeds: [] }).content,
    ).toBeUndefined();
  });

  it("skips embeds with nothing renderable", () => {
    expect(
      renderTemplateToJson({ embeds: [{}, { color: 1 }] } as MessageTemplate)
        .embeds,
    ).toEqual([]);
  });

  it("clamps to Discord's limits", () => {
    const long = "x".repeat(5000);
    const { content, embeds } = renderTemplateToJson({
      content: long,
      embeds: Array.from({ length: 14 }, () => ({
        title: long,
        description: long,
        footer: { text: long },
        fields: Array.from({ length: 30 }, () => ({ name: long, value: long })),
      })),
    } as MessageTemplate);

    expect(content).toHaveLength(2000);
    expect(embeds).toHaveLength(10);
    expect(embeds[0].title).toHaveLength(256);
    expect(embeds[0].description).toHaveLength(4096);
    expect((embeds[0].footer as { text: string }).text).toHaveLength(2048);
    const fields = embeds[0].fields as { name: string; value: string }[];
    expect(fields).toHaveLength(25);
    expect(fields[0].name).toHaveLength(256);
    expect(fields[0].value).toHaveLength(1024);
  });

  it("substitutes a zero-width space for an empty field name or value", () => {
    // Discord rejects the whole message otherwise.
    const { embeds } = renderTemplateToJson({
      embeds: [{ fields: [{ name: "", value: "" }] }],
    } as MessageTemplate);
    const fields = embeds[0].fields as { name: string; value: string }[];
    expect(fields[0].name).not.toBe("");
    expect(fields[0].value).not.toBe("");
  });

  it("normalises a valid timestamp and drops a malformed one", () => {
    expect(
      renderTemplateToJson({
        embeds: [{ title: "T", timestamp: "2026-08-22T12:00:00Z" }],
      } as MessageTemplate).embeds[0].timestamp,
    ).toBe("2026-08-22T12:00:00.000Z");

    expect(
      renderTemplateToJson({
        embeds: [{ title: "T", timestamp: "nonsense" }],
      } as MessageTemplate).embeds[0].timestamp,
    ).toBeUndefined();
  });

  it("omits an author icon rather than sending an empty string", () => {
    const { embeds } = renderTemplateToJson({
      embeds: [{ author: { name: "A", iconUrl: "" } }],
    } as MessageTemplate);
    expect((embeds[0].author as { icon_url?: string }).icon_url).toBeUndefined();
  });

  it("keeps a zero colour", () => {
    expect(
      renderTemplateToJson({
        embeds: [{ title: "T", color: 0 }],
      } as MessageTemplate).embeds[0].color,
    ).toBe(0);
  });

  it("renders an empty template to an empty payload", () => {
    expect(renderTemplateToJson({ content: "", embeds: [] })).toEqual({
      content: undefined,
      embeds: [],
    });
  });
});
