// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TranscriptMention } from "@/db/schema";
import { InlineMarkdown, MarkdownContent } from "./markdown";

afterEach(cleanup);

const mentions: TranscriptMention[] = [
  { id: "1", name: "ada", type: "user" },
  { id: "2", name: "Support", type: "role" },
  { id: "3", name: "general", type: "channel" },
];

const md = (content: string) => {
  const { container } = render(
    <MarkdownContent content={content} mentions={mentions} />,
  );
  return container;
};

describe("MarkdownContent — text styles", () => {
  it.each([
    { input: "**bold**", tag: "strong", text: "bold" },
    { input: "*italic*", tag: "em", text: "italic" },
    { input: "_italic_", tag: "em", text: "italic" },
    { input: "__underline__", tag: "u", text: "underline" },
    { input: "~~strike~~", tag: "s", text: "strike" },
  ])("renders $input as <$tag>", ({ input, tag, text }) => {
    const el = md(input).querySelector(tag);
    expect(el).not.toBeNull();
    expect(el).toHaveTextContent(text);
  });

  it("nests styles", () => {
    const strong = md("**bold and *italic* inside**").querySelector("strong");
    expect(strong?.querySelector("em")).toHaveTextContent("italic");
  });

  it.each([
    { input: "2 * 3 * 4", why: "arithmetic with spaced asterisks" },
    { input: "a _ b _ c", why: "spaced underscores" },
  ])("leaves $why literal", ({ input }) => {
    // Discord only italicises when the markers hug the text.
    expect(md(input).textContent).toBe(input);
  });

  it("still italicises a single character", () => {
    expect(md("*a*").querySelector("em")).toHaveTextContent("a");
  });

  it("still italicises across spaces inside the markers", () => {
    expect(md("*two words*").querySelector("em")).toHaveTextContent(
      "two words",
    );
  });
});

describe("MarkdownContent — code", () => {
  it("renders inline code", () => {
    expect(md("use `npm ci` here").querySelector("code")).toHaveTextContent(
      "npm ci",
    );
  });

  it("does not format inside inline code", () => {
    // Otherwise pasted code gets mangled in the transcript.
    const code = md("`**not bold**`").querySelector("code");
    expect(code).toHaveTextContent("**not bold**");
    expect(code?.querySelector("strong")).toBeNull();
  });

  it("renders a fenced block as <pre><code>", () => {
    const pre = md("```\nline1\nline2\n```").querySelector("pre");
    expect(pre?.querySelector("code")).toHaveTextContent("line1");
  });

  it("strips the language tag from a fenced block", () => {
    const pre = md("```ts\nconst a = 1;\n```").querySelector("pre");
    expect(pre?.textContent).not.toContain("ts\n");
    expect(pre?.textContent).toContain("const a = 1;");
  });
});

describe("MarkdownContent — Discord entities", () => {
  it.each([
    { input: "<@1>", expected: "@ada" },
    { input: "<@!1>", expected: "@ada" },
    { input: "<@&2>", expected: "@Support" },
    { input: "<#3>", expected: "#general" },
  ])("resolves $input to $expected", ({ input, expected }) => {
    expect(md(input).textContent).toContain(expected);
  });

  it("falls back to the raw id for an unresolved mention", () => {
    // A member who left still has to render as something.
    expect(md("<@999>").textContent).toContain("999");
  });

  it("renders a custom emoji as its CDN image", () => {
    const img = md("<:party:12345>").querySelector("img");
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("/emojis/12345"),
    );
  });

  it("renders an animated custom emoji as a gif", () => {
    const img = md("<a:party:12345>").querySelector("img");
    expect(img?.getAttribute("src")).toContain(".gif");
  });

  it("hides spoiler content behind a control", () => {
    const container = md("||secret||");
    expect(container.textContent).toContain("secret");
    // It must not simply render as plain text.
    expect(container.innerHTML).not.toBe("secret");
  });
});

describe("MarkdownContent — links", () => {
  it("renders a masked link with its label and href", () => {
    const a = md("[docs](https://example.com)").querySelector("a");
    expect(a).toHaveAttribute("href", "https://example.com");
    expect(a).toHaveTextContent("docs");
  });

  it("linkifies a bare URL", () => {
    expect(md("see https://example.com now").querySelector("a")).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("opens links in a new tab without leaking the referrer", () => {
    const a = md("https://example.com").querySelector("a")!;
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });
});

describe("MarkdownContent — block level", () => {
  it("renders a blockquote", () => {
    const c = md("> quoted");
    expect(c.textContent).toContain("quoted");
    expect(c.innerHTML).not.toContain("&gt; quoted");
  });

  it.each([
    { input: "# Heading", size: "text-xl" },
    { input: "## Heading", size: "text-lg" },
    { input: "### Heading", size: "text-base" },
  ])("renders $input bold and sized $size", ({ input, size }) => {
    // Rendered as styled divs rather than h1-h3: this is chat content, not a
    // document, so it shouldn't contribute to the page outline.
    // The renderer's wrapper div, then the line inside it.
    const el = md(input).firstElementChild?.firstElementChild;
    expect(el).toHaveTextContent("Heading");
    expect(el?.className).toContain(size);
    expect(el?.className).toContain("font-bold");
  });

  it("renders a bullet list item", () => {
    expect(md("- first").textContent).toContain("first");
  });

  it("renders subtext", () => {
    expect(md("-# small print").textContent).toContain("small print");
  });

  it("does not read subtext as a bullet", () => {
    // `-#` starts with a dash; the list rule must not claim it first.
    expect(md("-# small print").textContent).not.toContain("• #");
  });

  it("keeps separate lines separate", () => {
    const c = md("line one\nline two");
    expect(c.textContent).toContain("line one");
    expect(c.textContent).toContain("line two");
  });

  it("renders nothing for empty content", () => {
    const { container } = render(<MarkdownContent content="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("InlineMarkdown", () => {
  it("renders styles without a block wrapper", () => {
    const { container } = render(<InlineMarkdown content="**bold**" />);
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("div")).toBeNull();
  });

  it("renders custom emoji, which Discord allows in embed titles", () => {
    const { container } = render(<InlineMarkdown content="<:party:1>" />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  it("does not linkify by default — embed titles don't render links", () => {
    const { container } = render(
      <InlineMarkdown content="[x](https://example.com)" />,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("linkifies when asked", () => {
    const { container } = render(
      <InlineMarkdown content="[x](https://example.com)" links />,
    );
    expect(container.querySelector("a")).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });

  it("resolves mentions", () => {
    render(<InlineMarkdown content="<@1>" mentions={mentions} />);
    expect(screen.getByText("@ada")).toBeInTheDocument();
  });

  it("renders nothing for empty content", () => {
    const { container } = render(<InlineMarkdown content="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
