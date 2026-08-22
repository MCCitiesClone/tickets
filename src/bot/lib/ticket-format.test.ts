import { describe, expect, it } from "vitest";

import { TICKET_PRIORITIES } from "@/lib/ticket-priority";
import {
  CATEGORY_FULL_ERROR_CODE,
  TOPIC_MAX_LENGTH,
  channelName,
  isCategoryFullError,
  sanitizePrefix,
  topicForPriority,
} from "./ticket-format";

describe("channelName", () => {
  it("substitutes the scheme's tokens", () => {
    expect(channelName("ticket-{number}", 42, "Ada")).toBe("ticket-42");
    expect(channelName("{username}-{number}", 42, "Ada")).toBe("ada-42");
  });

  it("substitutes a token used more than once", () => {
    expect(channelName("{number}-{number}", 7, "ada")).toBe("7-7");
  });

  it("lowercases and collapses illegal characters to single dashes", () => {
    expect(channelName("Bug Report #{number}", 42, "Ada")).toBe(
      "bug-report-42",
    );
  });

  it("keeps dashes and underscores, which Discord allows", () => {
    expect(channelName("a-b_c-{number}", 1, "x")).toBe("a-b_c-1");
  });

  it("trims leading and trailing dashes", () => {
    expect(channelName("!!{number}!!", 42, "x")).toBe("42");
  });

  it("handles a username that sanitises away entirely", () => {
    // Discord display names can be entirely non-Latin.
    expect(channelName("{username}-{number}", 42, "日本語")).toBe("42");
  });

  it("falls back to ticket-<number> when nothing survives", () => {
    expect(channelName("!!!", 42, "x")).toBe("ticket-42");
    expect(channelName("", 42, "x")).toBe("ticket-42");
    expect(channelName("{username}", 42, "日本語")).toBe("ticket-42");
  });

  it("truncates to Discord's 100-char channel name limit with headroom", () => {
    const name = channelName("x".repeat(200), 42, "y");
    expect(name).toHaveLength(90);
  });

  it("always produces a name Discord will accept", () => {
    const cases = [
      "ticket-{number}",
      "🎫 {username} #{number}",
      "   ",
      "UPPER_CASE",
      "a".repeat(300),
    ];
    for (const scheme of cases) {
      const name = channelName(scheme, 42, "Ada Lovelace");
      expect(name).toMatch(/^[a-z0-9][a-z0-9-_]*$/);
      expect(name.length).toBeLessThanOrEqual(90);
    }
  });
});

describe("sanitizePrefix", () => {
  it("lowercases and slugifies", () => {
    expect(sanitizePrefix("Bug Report")).toBe("bug-report");
  });

  it("trims stray dashes", () => {
    expect(sanitizePrefix("--bug--")).toBe("bug");
  });

  it("returns an empty string when nothing survives, so callers can reject it", () => {
    // `renameTicket` relies on this to reject an unusable name.
    expect(sanitizePrefix("!!!")).toBe("");
    expect(sanitizePrefix("日本語")).toBe("");
    expect(sanitizePrefix("")).toBe("");
  });

  it("truncates to 80 characters, leaving room for the -<number> suffix", () => {
    expect(sanitizePrefix("x".repeat(200))).toHaveLength(80);
  });
});

describe("isCategoryFullError", () => {
  it("matches Discord's error code", () => {
    expect(isCategoryFullError({ code: CATEGORY_FULL_ERROR_CODE })).toBe(true);
  });

  it("matches the message text as a fallback, case-insensitively", () => {
    expect(
      isCategoryFullError({ message: "Maximum number of channels in category reached" }),
    ).toBe(true);
    expect(
      isCategoryFullError({ message: "MAXIMUM NUMBER OF CHANNELS" }),
    ).toBe(true);
  });

  it.each([
    { err: null, why: "null" },
    { err: undefined, why: "undefined" },
    { err: "a string", why: "a string" },
    { err: 42, why: "a number" },
    { err: {}, why: "an empty object" },
    { err: { code: 50013 }, why: "Missing Permissions" },
    { err: { message: "Missing Access" }, why: "an unrelated message" },
  ])("rejects $why", ({ err }) => {
    // A false positive here silently routes a ticket to an overflow category
    // when the real problem was permissions.
    expect(isCategoryFullError(err)).toBe(false);
  });
});

describe("topicForPriority", () => {
  const base = "Ticket #42 · opened by ada <@1>";

  it("adds a badge for a non-default priority", () => {
    expect(topicForPriority(base, "urgent")).toBe(`🔴 URGENT · ${base}`);
    expect(topicForPriority(base, "high")).toBe(`🟠 HIGH · ${base}`);
    expect(topicForPriority(base, "low")).toBe(`🔵 LOW · ${base}`);
  });

  it("adds no badge for the default priority", () => {
    expect(topicForPriority(base, "normal")).toBe(base);
  });

  it("replaces an existing badge instead of stacking one in front", () => {
    let topic = base;
    for (const p of ["urgent", "high", "low", "urgent"] as const) {
      topic = topicForPriority(topic, p);
    }
    expect(topic).toBe(`🔴 URGENT · ${base}`);
    expect(topic.match(/·/g)).toHaveLength(2); // the badge's, and the topic's own
  });

  it("strips the badge when returning to normal", () => {
    expect(topicForPriority(topicForPriority(base, "urgent"), "normal")).toBe(
      base,
    );
  });

  it("is idempotent for the same priority", () => {
    const once = topicForPriority(base, "high");
    expect(topicForPriority(once, "high")).toBe(once);
  });

  it("emits a bare badge with no dangling separator on an empty topic", () => {
    expect(topicForPriority("", "high")).toBe("🟠 HIGH");
    expect(topicForPriority("", "normal")).toBe("");
  });

  it("recognises every priority's own badge", () => {
    for (const p of TICKET_PRIORITIES) {
      const badged = topicForPriority(base, p.value);
      // Whatever badge each priority writes must be strippable again.
      expect(topicForPriority(badged, "normal")).toBe(base);
    }
  });

  it("stays inside Discord's topic limit", () => {
    const long = "x".repeat(TOPIC_MAX_LENGTH);
    expect(topicForPriority(long, "urgent").length).toBeLessThanOrEqual(
      TOPIC_MAX_LENGTH,
    );
  });

  it("leaves a topic that merely mentions a priority word alone", () => {
    const tricky = "URGENT stuff · Ticket #42";
    expect(topicForPriority(tricky, "normal")).toBe(tricky);
  });
});
