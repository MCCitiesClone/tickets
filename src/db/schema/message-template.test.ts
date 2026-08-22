import { describe, expect, it } from "vitest";

import {
  isEmbedEmpty,
  isTemplateEmpty,
  type MessageTemplate,
  type TemplateEmbed,
} from "./message-template";

const embed = (e: Partial<TemplateEmbed> = {}): TemplateEmbed => ({ ...e });

describe("isEmbedEmpty", () => {
  it("treats a bare embed as empty", () => {
    expect(isEmbedEmpty(embed())).toBe(true);
  });

  it.each([
    ["title", embed({ title: "Hi" })],
    ["description", embed({ description: "Hi" })],
    ["author name", embed({ author: { name: "Hi" } })],
    ["footer text", embed({ footer: { text: "Hi" } })],
    ["image", embed({ image: { url: "https://example.com/a.png" } })],
    ["thumbnail", embed({ thumbnail: { url: "https://example.com/a.png" } })],
    ["a field", embed({ fields: [{ name: "n", value: "v" }] })],
  ])("is not empty with a %s", (_label, e) => {
    expect(isEmbedEmpty(e)).toBe(false);
  });

  it("ignores colour alone — Discord renders nothing for a bare colour", () => {
    expect(isEmbedEmpty(embed({ color: 0x5865f2 }))).toBe(true);
  });

  it("treats empty strings as absent", () => {
    expect(isEmbedEmpty(embed({ title: "", description: "" }))).toBe(true);
  });

  it("treats an empty field list as absent", () => {
    expect(isEmbedEmpty(embed({ fields: [] }))).toBe(true);
  });
});

describe("isTemplateEmpty", () => {
  it.each([{ input: null }, { input: undefined }])(
    "treats $input as empty",
    ({ input }) => {
      expect(isTemplateEmpty(input)).toBe(true);
    },
  );

  it("treats no content and no embeds as empty", () => {
    expect(isTemplateEmpty({ content: "", embeds: [] })).toBe(true);
  });

  it("is non-empty with content alone", () => {
    expect(isTemplateEmpty({ content: "hello", embeds: [] })).toBe(false);
  });

  it("is non-empty with a non-empty embed alone", () => {
    expect(
      isTemplateEmpty({ embeds: [embed({ title: "Hi" })] } as MessageTemplate),
    ).toBe(false);
  });

  it("is empty when every embed is itself empty", () => {
    // An admin who adds two embed cards and fills in neither should still get
    // the built-in default message, not a blank one.
    expect(
      isTemplateEmpty({ content: "", embeds: [embed(), embed()] }),
    ).toBe(true);
  });

  it("treats whitespace-only content as empty", () => {
    expect(isTemplateEmpty({ content: "   ", embeds: [] })).toBe(true);
  });
});
