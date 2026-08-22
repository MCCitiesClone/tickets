import type { TicketPriority } from "@/db/schema";
import {
  DEFAULT_TICKET_PRIORITY,
  TICKET_PRIORITIES,
  priorityMeta,
} from "@/lib/ticket-priority";

/**
 * Pure string/shape helpers for ticket channels, kept apart from `tickets.ts`
 * so they can be reasoned about (and tested) without dragging in discord.js,
 * the database, or the interaction plumbing.
 */

/** Discord caps a channel topic at 1024 characters. */
export const TOPIC_MAX_LENGTH = 1024;

/** Discord JSON error code: "Maximum number of channels in category reached". */
export const CATEGORY_FULL_ERROR_CODE = 30030;

/**
 * Reduce a string to what Discord accepts in a channel name: lowercase, and
 * only letters, digits, dashes and underscores. Runs of anything else collapse
 * to a single dash, and leading/trailing dashes are trimmed.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Turn a naming scheme into a valid Discord channel name, substituting
 * `{number}` and `{username}`. Falls back to `ticket-<number>` when the scheme
 * sanitises away to nothing, so a ticket can never end up nameless.
 */
export function channelName(
  scheme: string,
  number: number,
  username: string,
): string {
  return (
    slugify(
      scheme
        .replaceAll("{number}", String(number))
        .replaceAll("{username}", username),
    ).slice(0, 90) || `ticket-${number}`
  );
}

/** Sanitize a staff-supplied prefix into a Discord-safe channel-name segment. */
export function sanitizePrefix(input: string): string {
  return slugify(input).slice(0, 80);
}

/**
 * Whether an error from `channels.create` means the category is full. Matches
 * Discord's error code, falling back to the message text — a reactive backstop
 * to the proactive channel counting in `createTicketChannel`.
 */
export function isCategoryFullError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as { code?: number; message?: string };
  return (
    code === CATEGORY_FULL_ERROR_CODE ||
    /maximum number of channels/i.test(message ?? "")
  );
}

/**
 * The badge a non-default priority prepends to a ticket channel's topic, e.g.
 * `🔴 URGENT · Ticket #42 · opened by …`. Matching it lets a re-prioritise
 * replace the old badge instead of stacking a new one in front of it.
 */
const TOPIC_PRIORITY_BADGE = new RegExp(
  `^(?:${TICKET_PRIORITIES.map((p) => `${p.emoji} ${p.label.toUpperCase()}`).join(
    "|",
  )}) · `,
);

/** Re-badge a channel topic for `priority` (the default priority = no badge). */
export function topicForPriority(
  topic: string,
  priority: TicketPriority,
): string {
  const base = topic.replace(TOPIC_PRIORITY_BADGE, "");
  if (priority === DEFAULT_TICKET_PRIORITY) return base;
  const { emoji, label } = priorityMeta(priority);
  const badge = `${emoji} ${label.toUpperCase()}`;
  // A topic-less ticket gets the bare badge — no dangling separator.
  return (base ? `${badge} · ${base}` : badge).slice(0, TOPIC_MAX_LENGTH);
}
