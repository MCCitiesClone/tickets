import type { TicketPriority } from "@/db/schema";

/**
 * Presentation metadata for the four ticket priorities, in ascending order of
 * urgency. This is the single source of truth shared by the bot (`/priority`,
 * channel topics, log lines) and the dashboard (badges, filters), so a priority
 * always reads the same wherever it shows up.
 *
 * `rank` orders tickets most-urgent-first in listings; `embedColor` is a Discord
 * embed colour, `className` the dashboard badge styling.
 */
export const TICKET_PRIORITIES = [
  {
    value: "low",
    label: "Low",
    emoji: "🔵",
    rank: 0,
    embedColor: 0x3498db,
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    value: "normal",
    label: "Normal",
    emoji: "⚪",
    rank: 1,
    embedColor: 0x99aab5,
    className: "bg-muted text-muted-foreground",
  },
  {
    value: "high",
    label: "High",
    emoji: "🟠",
    rank: 2,
    embedColor: 0xe67e22,
    className: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    value: "urgent",
    label: "Urgent",
    emoji: "🔴",
    rank: 3,
    embedColor: 0xed4245,
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
] as const satisfies readonly {
  value: TicketPriority;
  label: string;
  emoji: string;
  rank: number;
  embedColor: number;
  className: string;
}[];

export type TicketPriorityMeta = (typeof TICKET_PRIORITIES)[number];

/** The priority every ticket opens at. */
export const DEFAULT_TICKET_PRIORITY: TicketPriority = "normal";

/**
 * Priorities exempt from inactivity auto-close when a guild turns on
 * `autoCloseExcludeHighPriority`.
 */
export const ESCALATED_PRIORITIES: readonly TicketPriority[] = [
  "high",
  "urgent",
];

/** Whether a priority counts as escalated (high or urgent). */
export function isEscalatedPriority(priority: TicketPriority): boolean {
  return ESCALATED_PRIORITIES.includes(priority);
}

/** Metadata for a priority, falling back to the default for unknown values. */
export function priorityMeta(
  priority: TicketPriority | null | undefined,
): TicketPriorityMeta {
  const fallback = TICKET_PRIORITIES.find(
    (p) => p.value === DEFAULT_TICKET_PRIORITY,
  )!;
  return TICKET_PRIORITIES.find((p) => p.value === priority) ?? fallback;
}

/** Human label with its emoji, e.g. "🔴 Urgent". */
export function priorityLabel(
  priority: TicketPriority | null | undefined,
): string {
  const meta = priorityMeta(priority);
  return `${meta.emoji} ${meta.label}`;
}
