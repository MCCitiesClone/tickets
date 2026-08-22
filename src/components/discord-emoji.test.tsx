// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DiscordEmoji } from "./discord-emoji";

afterEach(cleanup);

describe("DiscordEmoji", () => {
  it("renders a custom emoji mention as its CDN image", () => {
    render(<DiscordEmoji emoji="<:party:12345>" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "src",
      "https://cdn.discordapp.com/emojis/12345.png?size=32",
    );
    expect(img).toHaveAttribute("alt", "party");
  });

  it("renders an animated mention as a gif", () => {
    render(<DiscordEmoji emoji="<a:party:12345>" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "https://cdn.discordapp.com/emojis/12345.gif?size=32",
    );
  });

  it("renders a :shortcode: as its unicode glyph", () => {
    const { container } = render(<DiscordEmoji emoji=":rocket:" />);
    expect(container.textContent).toBe("🚀");
  });

  it("renders a bare shortcode name too", () => {
    const { container } = render(<DiscordEmoji emoji="rocket" />);
    expect(container.textContent).toBe("🚀");
  });

  it("passes a raw unicode emoji through", () => {
    const { container } = render(<DiscordEmoji emoji="📩" />);
    expect(container.textContent).toBe("📩");
  });

  it("trims surrounding whitespace", () => {
    const { container } = render(<DiscordEmoji emoji="  :rocket:  " />);
    expect(container.textContent).toBe("🚀");
  });

  it.each([
    { emoji: null, why: "null" },
    { emoji: undefined, why: "undefined" },
    { emoji: "", why: "an empty string" },
    { emoji: "   ", why: "whitespace" },
    { emoji: "not-an-emoji", why: "unresolvable ASCII text" },
  ])("renders nothing for $why", ({ emoji }) => {
    // Matches the bot omitting an emoji it can't resolve, rather than
    // sending something Discord would reject.
    const { container } = render(<DiscordEmoji emoji={emoji} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("applies a custom className", () => {
    const { container } = render(
      <DiscordEmoji emoji="📩" className="size-8" />,
    );
    expect(container.firstElementChild).toHaveClass("size-8");
  });
});
