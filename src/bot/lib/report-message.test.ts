import { describe, expect, it } from "vitest";
import type { Message } from "discord.js";

import {
  buildReportEmbed,
  encodeReportRef,
  messageLink,
  toReportedMessage,
  type ReportedMessage,
} from "./report-message";

const SENT = new Date("2026-08-22T09:00:00Z");
const SENT_UNIX = Math.floor(SENT.getTime() / 1000);

const report = (o: Partial<ReportedMessage> = {}): ReportedMessage => ({
  messageId: "111",
  channelId: "222",
  guildId: "333",
  authorId: "444",
  authorTag: "Offender",
  content: "something rude",
  attachmentNames: [],
  embedCount: 0,
  createdAt: SENT,
  ...o,
});

describe("toReportedMessage", () => {
  const message = (o: Record<string, unknown> = {}): Message =>
    ({
      id: "111",
      channelId: "222",
      guildId: "333",
      author: {
        id: "444",
        username: "offender",
        displayName: "Offender",
      },
      member: null,
      content: "something rude",
      attachments: new Map(),
      embeds: [],
      createdAt: SENT,
      ...o,
    }) as unknown as Message;

  it("captures the message's identity and content", () => {
    expect(toReportedMessage(message())).toMatchObject({
      messageId: "111",
      channelId: "222",
      guildId: "333",
      authorId: "444",
      authorTag: "Offender",
      content: "something rude",
    });
  });

  it("prefers the guild nickname, which is what witnesses saw", () => {
    expect(
      toReportedMessage(message({ member: { displayName: "Nickname" } }))
        .authorTag,
    ).toBe("Nickname");
  });

  it("falls back to the username when there's no display name", () => {
    expect(
      toReportedMessage(
        message({ author: { id: "444", username: "offender", displayName: null } }),
      ).authorTag,
    ).toBe("offender");
  });

  it("normalises absent content to an empty string", () => {
    expect(toReportedMessage(message({ content: null })).content).toBe("");
  });

  it("records attachment names but not their URLs", () => {
    // The URLs expire; the names are what a report needs to describe.
    const captured = toReportedMessage(
      message({
        attachments: new Map([["a", { name: "slur.png", url: "https://x" }]]),
      }),
    );
    expect(captured.attachmentNames).toEqual(["slur.png"]);
    expect(JSON.stringify(captured)).not.toContain("https://x");
  });

  it("counts embeds it can't reproduce", () => {
    expect(toReportedMessage(message({ embeds: [{}, {}] })).embedCount).toBe(2);
  });
});

describe("messageLink", () => {
  it("builds a Discord permalink", () => {
    expect(messageLink(report())).toBe(
      "https://discord.com/channels/333/222/111",
    );
  });
});

describe("encodeReportRef", () => {
  it("encodes channel and message for a customId", () => {
    expect(encodeReportRef(report())).toBe("222:111");
  });

  it("stays within Discord's 100-character customId limit when combined", () => {
    // `ticket_form:<uuid>:<channelId>:<messageId>` is the longest form.
    const customId = `ticket_form:${"0".repeat(36)}:${encodeReportRef(
      report({ channelId: "1".repeat(19), messageId: "2".repeat(19) }),
    )}`;
    expect(customId.length).toBeLessThanOrEqual(100);
  });
});

describe("buildReportEmbed", () => {
  const description = (r: ReportedMessage) =>
    buildReportEmbed(r).data.description!;

  it("names the author as both a mention and a snapshotted name", () => {
    // The mention is actionable; the name survives a later rename.
    const text = description(report());
    expect(text).toContain("<@444>");
    expect(text).toContain("Offender");
    expect(text).toContain("444");
  });

  it("records when and where it was sent", () => {
    const text = description(report());
    expect(text).toContain(`<t:${SENT_UNIX}:F>`);
    expect(text).toContain("<#222>");
  });

  it("links back to the original", () => {
    expect(description(report())).toContain(
      "https://discord.com/channels/333/222/111",
    );
  });

  it("quotes the content so it can't be read as the reporter's words", () => {
    expect(description(report())).toContain("> something rude");
  });

  it("quotes every line of multi-line content", () => {
    const text = description(report({ content: "line one\nline two" }));
    expect(text).toContain("> line one");
    expect(text).toContain("> line two");
  });

  it("says so when the message had no text", () => {
    // An image-only message is a very common report.
    expect(description(report({ content: "" }))).toContain("no text content");
  });

  it("lists attachments by name", () => {
    expect(
      description(report({ attachmentNames: ["a.png", "b.png"] })),
    ).toContain("a.png, b.png");
  });

  it("notes embeds it can't reproduce", () => {
    expect(description(report({ embedCount: 2 }))).toContain("2 embed(s)");
  });

  it("truncates very long content and says it did", () => {
    const text = description(report({ content: "x".repeat(5000) }));
    expect(text).toContain("truncated");
    expect(text.length).toBeLessThanOrEqual(4096);
  });

  it("stays within the embed description limit under everything at once", () => {
    const text = description(
      report({
        content: "x".repeat(5000),
        attachmentNames: Array.from({ length: 10 }, (_, i) => `file${i}.png`),
        embedCount: 5,
      }),
    );
    expect(text.length).toBeLessThanOrEqual(4096);
  });
});
