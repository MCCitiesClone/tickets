// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { collectMentionIds, DiscordMentions } from "./discord-mentions";

afterEach(cleanup);

const names = {
  users: { "11111111111111111": "ada" },
  roles: { "22222222222222222": "Support" },
  channels: { "33333333333333333": "general" },
};

const text = (content: string) =>
  render(<DiscordMentions text={content} names={names} />).container
    .textContent;

describe("DiscordMentions", () => {
  it.each([
    { input: "<@11111111111111111>", expected: "@ada" },
    { input: "<@!11111111111111111>", expected: "@ada" },
    { input: "<@&22222222222222222>", expected: "@Support" },
    { input: "<#33333333333333333>", expected: "#general" },
  ])("renders $input as $expected", ({ input, expected }) => {
    expect(text(input)).toBe(expected);
  });

  it("keeps the surrounding text", () => {
    expect(text("Ticket #4 closed by <@11111111111111111> — spam")).toBe(
      "Ticket #4 closed by @ada — spam",
    );
  });

  it("renders several mentions in one line", () => {
    expect(
      text("<@11111111111111111> pinged <@&22222222222222222> in <#33333333333333333>"),
    ).toBe("@ada pinged @Support in #general");
  });

  it("falls back to the raw ID when a name is unknown", () => {
    // Someone who has left the server still has to be identifiable.
    expect(text("<@99999999999999999>")).toBe("@99999999999999999");
  });

  it("leaves text with no mentions untouched", () => {
    expect(text("Server settings saved")).toBe("Server settings saved");
  });

  it("ignores things that only look like mentions", () => {
    expect(text("<@nope> and <@1>")).toBe("<@nope> and <@1>");
  });

  it("keeps the raw ID available as a tooltip", () => {
    const { container } = render(
      <DiscordMentions text="<@11111111111111111>" names={names} />,
    );
    expect(container.querySelector("span[title]")).toHaveAttribute(
      "title",
      "11111111111111111",
    );
  });

  it("renders an empty string as nothing", () => {
    expect(text("")).toBe("");
  });

  it("works with no name map at all", () => {
    const { container } = render(
      <DiscordMentions text="<@11111111111111111>" />,
    );
    expect(container.textContent).toBe("@11111111111111111");
  });
});

describe("collectMentionIds", () => {
  it("groups IDs by kind", () => {
    expect(
      collectMentionIds([
        "<@11111111111111111> and <@&22222222222222222>",
        "in <#33333333333333333>",
      ]),
    ).toEqual({
      users: ["11111111111111111"],
      roles: ["22222222222222222"],
      channels: ["33333333333333333"],
    });
  });

  it("deduplicates across entries, so one lookup per ID", () => {
    expect(
      collectMentionIds([
        "<@11111111111111111>",
        "<@11111111111111111>",
        "<@!11111111111111111>",
      ]).users,
    ).toEqual(["11111111111111111"]);
  });

  it("returns empty lists for text with no mentions", () => {
    expect(collectMentionIds(["nothing here", ""])).toEqual({
      users: [],
      roles: [],
      channels: [],
    });
  });

  it("treats the nickname form as a user", () => {
    expect(collectMentionIds(["<@!11111111111111111>"]).users).toEqual([
      "11111111111111111",
    ]);
  });
});
