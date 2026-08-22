import { describe, expect, it } from "vitest";
import type { Message } from "discord.js";

import { messageToRow } from "./message-snapshot";

/**
 * Stand-in for a discord.js `Message`, shaped just enough for the fields
 * `messageToRow` reads. Keeping it explicit here documents exactly which parts
 * of the gateway payload a transcript depends on.
 */
function message(overrides: Record<string, unknown> = {}): Message {
  return {
    id: "m1",
    author: {
      id: "u1",
      username: "ada",
      displayName: "Ada",
      bot: false,
      displayAvatarURL: () => "https://cdn/u1.png",
    },
    member: null,
    content: "hello",
    attachments: new Map(),
    embeds: [],
    mentions: { users: new Map(), roles: new Map(), channels: new Map() },
    reference: null,
    editedAt: null,
    createdAt: new Date("2026-08-22T12:00:00Z"),
    ...overrides,
  } as unknown as Message;
}

describe("messageToRow", () => {
  it("captures the core fields", () => {
    const row = messageToRow(message(), "t1");
    expect(row).toMatchObject({
      ticketId: "t1",
      discordMessageId: "m1",
      authorId: "u1",
      authorTag: "Ada",
      authorBot: false,
      content: "hello",
      replyToId: null,
      editedAt: null,
    });
    expect(row.createdAt).toEqual(new Date("2026-08-22T12:00:00Z"));
  });

  it("prefers the guild nickname over the global display name", () => {
    // The transcript should show the name people actually saw in the channel.
    const row = messageToRow(
      message({
        member: { displayName: "Ada (staff)", displayAvatarURL: () => "https://cdn/m.png" },
      }),
      "t1",
    );
    expect(row.authorTag).toBe("Ada (staff)");
    expect(row.authorAvatarUrl).toBe("https://cdn/m.png");
  });

  it("falls back to the username when no display name exists", () => {
    const row = messageToRow(
      message({
        author: {
          id: "u1",
          username: "ada",
          displayName: null,
          bot: false,
          displayAvatarURL: () => "https://cdn/u1.png",
        },
      }),
      "t1",
    );
    expect(row.authorTag).toBe("ada");
  });

  it("records bot authorship, which the transcript renders differently", () => {
    const row = messageToRow(
      message({
        author: {
          id: "b1",
          username: "Tickets",
          displayName: "Tickets",
          bot: true,
          displayAvatarURL: () => "https://cdn/b.png",
        },
      }),
      "t1",
    );
    expect(row.authorBot).toBe(true);
  });

  it("normalises absent content to an empty string", () => {
    // An embed-only or attachment-only message has null content.
    expect(messageToRow(message({ content: null }), "t1").content).toBe("");
  });

  it("snapshots attachment metadata", () => {
    const row = messageToRow(
      message({
        attachments: new Map([
          [
            "a1",
            {
              id: "a1",
              url: "https://cdn/a.png",
              name: "a.png",
              contentType: "image/png",
              width: 10,
              height: 20,
              size: 1234,
            },
          ],
        ]),
      }),
      "t1",
    );
    expect(row.attachments).toEqual([
      {
        id: "a1",
        url: "https://cdn/a.png",
        name: "a.png",
        contentType: "image/png",
        width: 10,
        height: 20,
        size: 1234,
      },
    ]);
  });

  it("reduces an embed to the subset the viewer renders", () => {
    const row = messageToRow(
      message({
        embeds: [
          {
            title: "T",
            description: "D",
            url: "https://x",
            color: 123,
            author: { name: "A", iconURL: "https://x/a.png", url: "https://x" },
            fields: [{ name: "n", value: "v", inline: true }],
            image: { url: "https://x/i.png" },
            thumbnail: { url: "https://x/t.png" },
            footer: { text: "F", iconURL: "https://x/f.png" },
            timestamp: "2026-08-22T12:00:00.000Z",
          },
        ],
      }),
      "t1",
    );
    expect(row.embeds?.[0]).toEqual({
      title: "T",
      description: "D",
      url: "https://x",
      color: 123,
      author: { name: "A", iconUrl: "https://x/a.png", url: "https://x" },
      fields: [{ name: "n", value: "v", inline: true }],
      image: { url: "https://x/i.png" },
      thumbnail: { url: "https://x/t.png" },
      footer: { text: "F", iconUrl: "https://x/f.png" },
      timestamp: "2026-08-22T12:00:00.000Z",
    });
  });

  it("omits embed parts that aren't set, rather than storing empty keys", () => {
    const row = messageToRow(
      message({ embeds: [{ title: "T", fields: [] }] }),
      "t1",
    );
    expect(row.embeds?.[0]).toEqual({ title: "T" });
  });

  it("resolves user, role and channel mentions to readable names", () => {
    const row = messageToRow(
      message({
        mentions: {
          users: new Map([["u2", { id: "u2", username: "bob" }]]),
          roles: new Map([["r1", { id: "r1", name: "Support" }]]),
          channels: new Map([["c1", { id: "c1", name: "general" }]]),
        },
      }),
      "t1",
    );
    expect(row.mentions).toEqual([
      { id: "u2", name: "bob", type: "user" },
      { id: "r1", name: "Support", type: "role" },
      { id: "c1", name: "general", type: "channel" },
    ]);
  });

  it("falls back to the id for a channel with no name", () => {
    // DM channels have no name; the viewer still needs something to render.
    const row = messageToRow(
      message({
        mentions: {
          users: new Map(),
          roles: new Map(),
          channels: new Map([["c1", { id: "c1" }]]),
        },
      }),
      "t1",
    );
    expect(row.mentions).toEqual([{ id: "c1", name: "c1", type: "channel" }]);
  });

  it("records the message a reply points at", () => {
    expect(
      messageToRow(message({ reference: { messageId: "m0" } }), "t1").replyToId,
    ).toBe("m0");
  });

  it("records an edit timestamp", () => {
    const editedAt = new Date("2026-08-22T13:00:00Z");
    expect(messageToRow(message({ editedAt }), "t1").editedAt).toEqual(editedAt);
  });
});
