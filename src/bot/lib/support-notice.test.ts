import { describe, expect, it } from "vitest";

import type { Guild } from "@/db/schema";
import type { SupportInterval } from "@/lib/support-hours";
import { buildSupportNotice } from "./support-notice";

const weekdays: SupportInterval[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  start: "09:00",
  end: "17:00",
}));

const config = (o: Partial<Guild> = {}): Guild =>
  ({
    supportTimezone: "UTC",
    supportHours: [],
    supportResponseHint: null,
    ...o,
  }) as Guild;

const MID_SHIFT = new Date("2026-08-24T12:00:00Z"); // Monday
const WEEKEND = new Date("2026-08-22T14:00:00Z"); // Saturday

const text = (...args: Parameters<typeof buildSupportNotice>) =>
  buildSupportNotice(...args)?.data.description ?? null;

describe("buildSupportNotice", () => {
  it("says nothing when neither hours nor a hint are configured", () => {
    // A ticket shouldn't gain a message just because the feature exists.
    expect(buildSupportNotice(config(), MID_SHIFT)).toBeNull();
  });

  it("says nothing inside hours with no hint", () => {
    expect(
      buildSupportNotice(config({ supportHours: weekdays }), MID_SHIFT),
    ).toBeNull();
  });

  it("shows the hint inside hours", () => {
    expect(
      text(
        config({
          supportHours: weekdays,
          supportResponseHint: "usually within 2 hours",
        }),
        MID_SHIFT,
      ),
    ).toContain("usually within 2 hours");
  });

  it("shows the hint with no schedule at all", () => {
    const notice = text(
      config({ supportResponseHint: "usually within 2 hours" }),
      MID_SHIFT,
    );
    expect(notice).toContain("usually within 2 hours");
    expect(notice).not.toContain("outside its usual hours");
  });

  it("warns when outside hours", () => {
    expect(text(config({ supportHours: weekdays }), WEEKEND)).toContain(
      "outside its usual hours",
    );
  });

  it("gives the next opening as relative and absolute timestamps", () => {
    // Discord renders these in each reader's own timezone.
    const notice = text(config({ supportHours: weekdays }), WEEKEND)!;
    const opensAt = Math.floor(Date.parse("2026-08-24T09:00:00Z") / 1000);
    expect(notice).toContain(`<t:${opensAt}:R>`);
    expect(notice).toContain(`<t:${opensAt}:F>`);
  });

  it("resolves the next opening in the guild's timezone", () => {
    const notice = text(
      config({ supportHours: weekdays, supportTimezone: "America/New_York" }),
      WEEKEND,
    )!;
    const opensAt = Math.floor(Date.parse("2026-08-24T13:00:00Z") / 1000);
    expect(notice).toContain(`<t:${opensAt}:R>`);
  });

  it("lists the usual hours and names the timezone", () => {
    const notice = text(
      config({ supportHours: weekdays, supportTimezone: "Europe/London" }),
      WEEKEND,
    )!;
    expect(notice).toContain("Europe/London");
    expect(notice).toContain("Monday: 09:00–17:00");
    expect(notice).toContain("Friday: 09:00–17:00");
  });

  it("combines the out-of-hours warning with the hint", () => {
    const notice = text(
      config({
        supportHours: weekdays,
        supportResponseHint: "usually within 2 hours",
      }),
      WEEKEND,
    )!;
    expect(notice).toContain("outside its usual hours");
    expect(notice).toContain("usually within 2 hours");
  });

  it("ignores a whitespace-only hint", () => {
    expect(
      buildSupportNotice(config({ supportResponseHint: "   " }), MID_SHIFT),
    ).toBeNull();
  });

  it("treats a schedule of only invalid intervals as always open", () => {
    expect(
      buildSupportNotice(
        config({ supportHours: [{ day: 1, start: "17:00", end: "09:00" }] }),
        WEEKEND,
      ),
    ).toBeNull();
  });

  it("stays within Discord's description limit", () => {
    // Every day, many spans, plus a long hint.
    const busy: SupportInterval[] = [0, 1, 2, 3, 4, 5, 6].flatMap((day) =>
      Array.from({ length: 10 }, (_, i) => ({
        day,
        start: `0${i}:00`,
        end: `0${i}:30`,
      })),
    );
    const notice = text(
      config({ supportHours: busy, supportResponseHint: "x".repeat(3000) }),
      WEEKEND,
    )!;
    expect(notice.length).toBeLessThanOrEqual(4096);
  });
});
