/**
 * `{token}` substitution shared by the bot's message renderer and the
 * dashboard's editor legend.
 *
 * Most tokens are looked up in the caller's `vars` map. Date/time tokens are
 * different: they're resolved here, at send time, into Discord's dynamic
 * timestamp markup (`<t:unix:style>`) so every reader sees the value in their
 * own timezone and locale — which a pre-formatted string can't do.
 */

/** Discord timestamp styles, as documented for `<t:unix:style>`. */
const STYLES = "tTdDfFR";

/** Offset units accepted after a time token, in milliseconds. */
const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Style each time token renders as when none is given explicitly. */
const DEFAULT_STYLE: Record<string, string> = {
  now: "f",
  datetime: "f",
  date: "d",
  time: "t",
};

/** `now` / `date` / `time` / `datetime`, an optional `±5h` offset, an optional `:R` style. */
const TIME_TOKEN = new RegExp(
  `^(now|date|time|datetime)(?:([+-])(\\d{1,6})([${Object.keys(UNIT_MS).join("")}]))?(?::([${STYLES}]))?$`,
);

/**
 * A `{token}`: any run without braces or whitespace. Deliberately loose —
 * anything that resolves to neither a time token nor a caller-supplied variable
 * is left in the text exactly as written.
 */
const PLACEHOLDER = /\{([^{}\s]+)\}/g;

/**
 * Resolve a date/time token to Discord timestamp markup, or null if `token`
 * isn't one. `{now}` is the full date and time, `{now:R}` is relative
 * ("in 2 hours"), and `{now+24h:R}` offsets from the current time.
 */
export function resolveTimePlaceholder(
  token: string,
  now: Date = new Date(),
): string | null {
  const match = TIME_TOKEN.exec(token);
  if (!match) return null;

  const [, name, sign, amount, unit, style] = match;
  let ms = now.getTime();
  if (sign && amount && unit) {
    const delta = Number(amount) * UNIT_MS[unit];
    ms += sign === "-" ? -delta : delta;
  }

  return `<t:${Math.floor(ms / 1000)}:${style ?? DEFAULT_STYLE[name]}>`;
}

/**
 * Substitute `{key}` tokens. Date/time tokens resolve dynamically; everything
 * else comes from `vars`. Unknown tokens are left untouched, so a template that
 * mentions a token its context doesn't provide degrades to literal text rather
 * than a blank.
 */
export function applyPlaceholders(
  text: string | undefined,
  vars: Record<string, string>,
  now: Date = new Date(),
): string | undefined {
  if (!text) return text;
  return text.replace(PLACEHOLDER, (match, key: string) => {
    if (key in vars) return vars[key];
    return resolveTimePlaceholder(key, now) ?? match;
  });
}

/**
 * Date/time tokens offered in the editor's token menu, with the descriptions
 * shown in its legend. Available in every template, unlike the context-specific
 * tokens each caller supplies.
 */
export const TIME_PLACEHOLDER_META: Record<string, string> = {
  now: "The current date and time, in each reader's timezone",
  date: "Today's date",
  time: "The current time",
  datetime: "The current date and time",
  "now:R": 'Relative to now — "3 minutes ago", "in 2 hours"',
  "now+24h:R": "Relative to 24 hours from now — offsets take s, m, h, d or w",
};

/** Just the token names, in menu order. */
export const TIME_PLACEHOLDERS = Object.keys(TIME_PLACEHOLDER_META);
