import { describe, expect, it } from "vitest";

import { EMBED_COLOR, noticeEmbed } from "./embeds";

describe("noticeEmbed", () => {
  it("sets the description", () => {
    expect(noticeEmbed("hello").data.description).toBe("hello");
  });

  it("defaults to the info colour", () => {
    expect(noticeEmbed("hello").data.color).toBe(EMBED_COLOR.info);
  });

  it("honours an explicit colour", () => {
    expect(noticeEmbed("bad", EMBED_COLOR.danger).data.color).toBe(
      EMBED_COLOR.danger,
    );
  });

  it("is chainable, as the callers assume", () => {
    const at = new Date("2026-08-22T12:00:00Z");
    expect(noticeEmbed("hi").setTimestamp(at).data.timestamp).toBe(
      at.toISOString(),
    );
  });
});

describe("EMBED_COLOR", () => {
  it("gives each role a distinct colour", () => {
    expect(new Set(Object.values(EMBED_COLOR)).size).toBe(
      Object.keys(EMBED_COLOR).length,
    );
  });

  it("keeps every colour inside Discord's 24-bit range", () => {
    for (const c of Object.values(EMBED_COLOR)) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });
});
