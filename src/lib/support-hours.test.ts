import { describe, expect, it } from "vitest";

import {
  describeSchedule,
  formatTimeOfDay,
  isValidTimeZone,
  isWithinSupportHours,
  nextOpeningAfter,
  parseTimeOfDay,
  usableIntervals,
  wallTimeToInstant,
  zonedParts,
  type SupportInterval,
} from "./support-hours";

/** Mon–Fri, 09:00–17:00. */
const weekdays: SupportInterval[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  start: "09:00",
  end: "17:00",
}));

describe("parseTimeOfDay", () => {
  it.each([
    { value: "00:00", minutes: 0 },
    { value: "09:30", minutes: 570 },
    { value: "23:59", minutes: 1439 },
  ])("parses $value", ({ value, minutes }) => {
    expect(parseTimeOfDay(value)).toBe(minutes);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseTimeOfDay("  09:00 ")).toBe(540);
  });

  it.each(["24:00", "9:00", "09:60", "0900", "", "nine"])(
    "rejects %s",
    (value) => {
      expect(parseTimeOfDay(value)).toBeNull();
    },
  );
});

describe("formatTimeOfDay", () => {
  it.each([
    { minutes: 0, value: "00:00" },
    { minutes: 540, value: "09:00" },
    { minutes: 1439, value: "23:59" },
  ])("formats $minutes as $value", ({ minutes, value }) => {
    expect(formatTimeOfDay(minutes)).toBe(value);
  });
});

describe("usableIntervals", () => {
  it("keeps a well-formed interval", () => {
    expect(usableIntervals(weekdays)).toHaveLength(5);
  });

  it.each([
    { why: "end before start", i: { day: 1, start: "17:00", end: "09:00" } },
    { why: "zero length", i: { day: 1, start: "09:00", end: "09:00" } },
    { why: "a bad time", i: { day: 1, start: "9am", end: "17:00" } },
    { why: "a day out of range", i: { day: 7, start: "09:00", end: "17:00" } },
    { why: "a negative day", i: { day: -1, start: "09:00", end: "17:00" } },
  ])("drops an interval with $why", ({ i }) => {
    // An overnight shift is two intervals, not one that wraps.
    expect(usableIntervals([i])).toEqual([]);
  });
});

describe("isValidTimeZone", () => {
  it.each(["UTC", "Europe/London", "America/New_York", "Asia/Tokyo"])(
    "accepts %s",
    (zone) => {
      expect(isValidTimeZone(zone)).toBe(true);
    },
  );

  it.each(["Mars/Olympus", "not a zone", ""])("rejects %s", (zone) => {
    expect(isValidTimeZone(zone)).toBe(false);
  });
});

describe("zonedParts", () => {
  it("reads the wall clock in the target zone, not UTC", () => {
    // 2026-08-22T12:00Z is 08:00 in New York (EDT, UTC-4).
    const parts = zonedParts(
      new Date("2026-08-22T12:00:00Z"),
      "America/New_York",
    );
    expect(parts).toMatchObject({
      year: 2026,
      month: 8,
      day: 22,
      minutes: 8 * 60,
    });
  });

  it("gives Saturday as weekday 6", () => {
    // 2026-08-22 is a Saturday.
    expect(zonedParts(new Date("2026-08-22T12:00:00Z"), "UTC").weekday).toBe(6);
  });

  it("rolls the local date back across the date line", () => {
    // 01:00Z on the 22nd is still the 21st in New York.
    expect(
      zonedParts(new Date("2026-08-22T01:00:00Z"), "America/New_York").day,
    ).toBe(21);
  });
});

describe("wallTimeToInstant", () => {
  it("resolves a UTC wall time to itself", () => {
    expect(
      wallTimeToInstant(2026, 8, 22, 9 * 60, "UTC").toISOString(),
    ).toBe("2026-08-22T09:00:00.000Z");
  });

  it("applies a summer offset", () => {
    // 09:00 in New York in August (EDT, UTC-4) is 13:00Z.
    expect(
      wallTimeToInstant(2026, 8, 22, 9 * 60, "America/New_York").toISOString(),
    ).toBe("2026-08-22T13:00:00.000Z");
  });

  it("applies a winter offset for the same zone and time", () => {
    // 09:00 in January (EST, UTC-5) is 14:00Z — a fixed offset would be wrong
    // for one of these two.
    expect(
      wallTimeToInstant(2026, 1, 22, 9 * 60, "America/New_York").toISOString(),
    ).toBe("2026-01-22T14:00:00.000Z");
  });

  it("handles a zone ahead of UTC", () => {
    // 09:00 in Tokyo (UTC+9, no DST) is 00:00Z.
    expect(
      wallTimeToInstant(2026, 8, 22, 9 * 60, "Asia/Tokyo").toISOString(),
    ).toBe("2026-08-22T00:00:00.000Z");
  });

  it("handles a half-hour offset", () => {
    // Kolkata is UTC+5:30.
    expect(
      wallTimeToInstant(2026, 8, 22, 9 * 60, "Asia/Kolkata").toISOString(),
    ).toBe("2026-08-22T03:30:00.000Z");
  });

  it("round-trips through zonedParts", () => {
    for (const zone of ["UTC", "Europe/London", "America/New_York", "Asia/Kolkata"]) {
      const instant = wallTimeToInstant(2026, 3, 15, 14 * 60 + 30, zone);
      const parts = zonedParts(instant, zone);
      expect({ ...parts, weekday: undefined }, zone).toMatchObject({
        year: 2026,
        month: 3,
        day: 15,
        minutes: 14 * 60 + 30,
      });
    }
  });
});

describe("isWithinSupportHours", () => {
  it("treats an empty schedule as always available", () => {
    // Support hours are opt-in; an unset schedule mustn't flag every ticket.
    expect(isWithinSupportHours(new Date(), [], "UTC")).toBe(true);
  });

  it("treats a schedule of only invalid intervals as always available", () => {
    expect(
      isWithinSupportHours(
        new Date(),
        [{ day: 1, start: "17:00", end: "09:00" }],
        "UTC",
      ),
    ).toBe(true);
  });

  it("is open mid-shift on a working day", () => {
    // Monday 2026-08-24, 12:00Z.
    expect(
      isWithinSupportHours(new Date("2026-08-24T12:00:00Z"), weekdays, "UTC"),
    ).toBe(true);
  });

  it("is open exactly at the start", () => {
    expect(
      isWithinSupportHours(new Date("2026-08-24T09:00:00Z"), weekdays, "UTC"),
    ).toBe(true);
  });

  it("is closed exactly at the end — the end is exclusive", () => {
    expect(
      isWithinSupportHours(new Date("2026-08-24T17:00:00Z"), weekdays, "UTC"),
    ).toBe(false);
  });

  it("is closed before opening", () => {
    expect(
      isWithinSupportHours(new Date("2026-08-24T08:59:00Z"), weekdays, "UTC"),
    ).toBe(false);
  });

  it("is closed at the weekend", () => {
    // Saturday.
    expect(
      isWithinSupportHours(new Date("2026-08-22T12:00:00Z"), weekdays, "UTC"),
    ).toBe(false);
  });

  it("judges the schedule in the guild's zone, not UTC", () => {
    // Monday 13:00Z is 09:00 in New York — open there, and the same instant
    // would read as mid-shift in UTC too, so use a time that differs: 12:00Z
    // is 08:00 New York, before opening.
    const at = new Date("2026-08-24T12:00:00Z");
    expect(isWithinSupportHours(at, weekdays, "UTC")).toBe(true);
    expect(isWithinSupportHours(at, weekdays, "America/New_York")).toBe(false);
  });

  it("supports two spans in one day, closed over the break", () => {
    const split: SupportInterval[] = [
      { day: 1, start: "09:00", end: "12:00" },
      { day: 1, start: "13:00", end: "17:00" },
    ];
    expect(
      isWithinSupportHours(new Date("2026-08-24T10:00:00Z"), split, "UTC"),
    ).toBe(true);
    expect(
      isWithinSupportHours(new Date("2026-08-24T12:30:00Z"), split, "UTC"),
    ).toBe(false);
    expect(
      isWithinSupportHours(new Date("2026-08-24T14:00:00Z"), split, "UTC"),
    ).toBe(true);
  });
});

describe("nextOpeningAfter", () => {
  it("returns null for an empty schedule", () => {
    expect(nextOpeningAfter(new Date(), [], "UTC")).toBeNull();
  });

  it("finds later the same day when asked before opening", () => {
    expect(
      nextOpeningAfter(
        new Date("2026-08-24T06:00:00Z"),
        weekdays,
        "UTC",
      )?.toISOString(),
    ).toBe("2026-08-24T09:00:00.000Z");
  });

  it("skips to the next working day when asked after closing", () => {
    expect(
      nextOpeningAfter(
        new Date("2026-08-24T18:00:00Z"),
        weekdays,
        "UTC",
      )?.toISOString(),
    ).toBe("2026-08-25T09:00:00.000Z");
  });

  it("skips the weekend", () => {
    // Saturday afternoon → Monday morning.
    expect(
      nextOpeningAfter(
        new Date("2026-08-22T14:00:00Z"),
        weekdays,
        "UTC",
      )?.toISOString(),
    ).toBe("2026-08-24T09:00:00.000Z");
  });

  it("returns the next opening even while currently open", () => {
    // Mid-shift Monday: the next *opening* is Tuesday.
    expect(
      nextOpeningAfter(
        new Date("2026-08-24T12:00:00Z"),
        weekdays,
        "UTC",
      )?.toISOString(),
    ).toBe("2026-08-25T09:00:00.000Z");
  });

  it("picks the earliest of two spans in a day", () => {
    const split: SupportInterval[] = [
      { day: 1, start: "13:00", end: "17:00" },
      { day: 1, start: "09:00", end: "12:00" },
    ];
    expect(
      nextOpeningAfter(
        new Date("2026-08-24T06:00:00Z"),
        split,
        "UTC",
      )?.toISOString(),
    ).toBe("2026-08-24T09:00:00.000Z");
  });

  it("resolves the opening in the guild's zone", () => {
    // Monday 09:00 New York is 13:00Z in August.
    expect(
      nextOpeningAfter(
        new Date("2026-08-24T06:00:00Z"),
        weekdays,
        "America/New_York",
      )?.toISOString(),
    ).toBe("2026-08-24T13:00:00.000Z");
  });

  it("lands on the right instant across a daylight-saving change", () => {
    // The UK leaves BST on 2026-10-25. Asked on Saturday the 24th, the next
    // Monday opening is 09:00 GMT = 09:00Z, not 08:00Z as BST would give.
    expect(
      nextOpeningAfter(
        new Date("2026-10-24T12:00:00Z"),
        weekdays,
        "Europe/London",
      )?.toISOString(),
    ).toBe("2026-10-26T09:00:00.000Z");
  });

  it("finds a single weekly slot from six days away", () => {
    const sundayOnly: SupportInterval[] = [
      { day: 0, start: "10:00", end: "12:00" },
    ];
    expect(
      nextOpeningAfter(
        new Date("2026-08-24T12:00:00Z"), // Monday
        sundayOnly,
        "UTC",
      )?.toISOString(),
    ).toBe("2026-08-30T10:00:00.000Z");
  });
});

describe("describeSchedule", () => {
  it("lists days Monday first", () => {
    expect(describeSchedule(weekdays)).toEqual([
      "Monday: 09:00–17:00",
      "Tuesday: 09:00–17:00",
      "Wednesday: 09:00–17:00",
      "Thursday: 09:00–17:00",
      "Friday: 09:00–17:00",
    ]);
  });

  it("puts Sunday last", () => {
    const lines = describeSchedule([
      { day: 0, start: "10:00", end: "12:00" },
      { day: 1, start: "09:00", end: "17:00" },
    ]);
    expect(lines[0]).toContain("Monday");
    expect(lines[1]).toContain("Sunday");
  });

  it("joins two spans in a day, earliest first", () => {
    expect(
      describeSchedule([
        { day: 1, start: "13:00", end: "17:00" },
        { day: 1, start: "09:00", end: "12:00" },
      ]),
    ).toEqual(["Monday: 09:00–12:00, 13:00–17:00"]);
  });

  it("omits days with no hours", () => {
    expect(describeSchedule([{ day: 3, start: "09:00", end: "17:00" }])).toEqual([
      "Wednesday: 09:00–17:00",
    ]);
  });

  it("describes an empty schedule as nothing", () => {
    expect(describeSchedule([])).toEqual([]);
  });
});
