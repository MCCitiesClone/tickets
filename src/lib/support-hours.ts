/**
 * Weekly support-hours schedule, and working out whether a moment falls inside
 * it — in the guild's own timezone, not the server's.
 *
 * Everything here is pure and timezone-aware via `Intl`, with no date library:
 * the only genuinely hard operation is turning a wall-clock time in a named
 * zone into a UTC instant, which `wallTimeToInstant` does by solving for the
 * zone's offset. That handles daylight saving, which a fixed offset would not.
 */

/** Days as `Date#getUTCDay` numbers them: 0 is Sunday. */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** One span of availability on one weekday, as `HH:MM` wall-clock times. */
export type SupportInterval = {
  /** 0 (Sunday) – 6 (Saturday). */
  day: number;
  /** Inclusive start, `HH:MM`. */
  start: string;
  /** Exclusive end, `HH:MM`. Must be after `start`. */
  end: string;
};

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since local midnight, or null if `value` isn't a valid `HH:MM`. */
export function parseTimeOfDay(value: string): number | null {
  const match = HH_MM.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** `HH:MM` for a minutes-since-midnight value. */
export function formatTimeOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Intervals worth evaluating: a well-formed time range on a real weekday.
 *
 * A range that ends at or before it starts is dropped rather than guessed at —
 * an overnight shift is expressed as two intervals (e.g. 22:00–23:59 and
 * 00:00–06:00 the next day), which keeps every other calculation simple.
 */
export function usableIntervals(intervals: SupportInterval[]): SupportInterval[] {
  return intervals.filter((i) => {
    const start = parseTimeOfDay(i.start);
    const end = parseTimeOfDay(i.end);
    return (
      Number.isInteger(i.day) &&
      i.day >= 0 &&
      i.day <= 6 &&
      start !== null &&
      end !== null &&
      end > start
    );
  });
}

/** Whether a zone name is one this runtime can actually resolve. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  /** Minutes since local midnight. */
  minutes: number;
};

const PART_FORMAT = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = PART_FORMAT.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    PART_FORMAT.set(timeZone, dtf);
  }
  return dtf;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Break an instant into its wall-clock parts in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** The zone's UTC offset in milliseconds at a given instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const seconds = Number(
    Object.fromEntries(
      formatter(timeZone)
        .formatToParts(instant)
        .map((x) => [x.type, x.value]),
    ).second,
  );
  const asIfUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    Math.floor(p.minutes / 60),
    p.minutes % 60,
    seconds,
  );
  // Millisecond component is unaffected by any real zone offset.
  return asIfUtc - instant.getTime() + instant.getMilliseconds();
}

/**
 * The UTC instant at which a wall-clock time occurs in a zone.
 *
 * Solved iteratively: guess the instant as if the wall time were UTC, read the
 * zone's offset there, correct, and repeat. Two passes converge for every real
 * zone, including across a daylight-saving change.
 */
export function wallTimeToInstant(
  year: number,
  month: number,
  day: number,
  minutes: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
  );
  let ts = naive;
  for (let pass = 0; pass < 2; pass++) {
    ts = naive - zoneOffsetMs(new Date(ts), timeZone);
  }
  return new Date(ts);
}

/**
 * Whether `at` falls inside the schedule.
 *
 * An empty schedule means "always available" — support hours are opt-in, and a
 * server that hasn't defined any shouldn't have every ticket flagged as
 * out-of-hours.
 */
export function isWithinSupportHours(
  at: Date,
  intervals: SupportInterval[],
  timeZone: string,
): boolean {
  const usable = usableIntervals(intervals);
  if (usable.length === 0) return true;

  const { weekday, minutes } = zonedParts(at, timeZone);
  return usable.some(
    (i) =>
      i.day === weekday &&
      minutes >= parseTimeOfDay(i.start)! &&
      minutes < parseTimeOfDay(i.end)!,
  );
}

/**
 * When support next opens after `at`, or null if the schedule is empty (always
 * available) or nothing is reachable within a week.
 *
 * Scans forward a day at a time in the guild's zone rather than doing modular
 * arithmetic on weekdays, so a daylight-saving change lands on the right
 * instant.
 */
export function nextOpeningAfter(
  at: Date,
  intervals: SupportInterval[],
  timeZone: string,
): Date | null {
  const usable = usableIntervals(intervals);
  if (usable.length === 0) return null;

  const DAY_MS = 86_400_000;
  let earliest: Date | null = null;

  for (let offset = 0; offset <= 7; offset++) {
    const probe = new Date(at.getTime() + offset * DAY_MS);
    const { year, month, day, weekday } = zonedParts(probe, timeZone);

    for (const interval of usable) {
      if (interval.day !== weekday) continue;
      const opensAt = wallTimeToInstant(
        year,
        month,
        day,
        parseTimeOfDay(interval.start)!,
        timeZone,
      );
      if (opensAt.getTime() <= at.getTime()) continue;
      if (!earliest || opensAt < earliest) earliest = opensAt;
    }
    // Once a day has produced a candidate, no later day can beat it.
    if (earliest) break;
  }

  return earliest;
}

/** A schedule as one readable line per day, for the outside-hours notice. */
export function describeSchedule(intervals: SupportInterval[]): string[] {
  const usable = usableIntervals(intervals);
  const byDay = new Map<number, SupportInterval[]>();
  for (const i of usable) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);

  // Monday-first reads more naturally than Sunday-first for opening hours.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.flatMap((day) => {
    const spans = byDay.get(day);
    if (!spans?.length) return [];
    const times = spans
      .slice()
      .sort((a, b) => parseTimeOfDay(a.start)! - parseTimeOfDay(b.start)!)
      .map((s) => `${s.start}–${s.end}`)
      .join(", ");
    return [`${DAY_NAMES[day]}: ${times}`];
  });
}
