/**
 * Discord's hard cap on channels nested under a single category. Every ticket
 * is a channel, so a busy ticket category runs into this — see the bot's
 * overflow-category routing in `openTicket`.
 */
export const CATEGORY_CHANNEL_LIMIT = 50;

/**
 * How close to the cap a category may get before it counts as "warning". Five
 * free slots is enough runway for an admin to add an overflow category (or turn
 * on auto-overflow) before opens start spilling over.
 */
export const CATEGORY_WARN_REMAINING = 5;

/** Channel count at or above which a category is considered near-full. */
export const CATEGORY_WARN_AT = CATEGORY_CHANNEL_LIMIT - CATEGORY_WARN_REMAINING;

export type CategoryCapacityLevel = "ok" | "warning" | "full";

/** Free channel slots left in a category (never negative). */
export function categoryRemaining(used: number): number {
  return Math.max(0, CATEGORY_CHANNEL_LIMIT - used);
}

/** Classify a category's channel count against the cap. */
export function categoryCapacityLevel(used: number): CategoryCapacityLevel {
  if (used >= CATEGORY_CHANNEL_LIMIT) return "full";
  if (used >= CATEGORY_WARN_AT) return "warning";
  return "ok";
}
