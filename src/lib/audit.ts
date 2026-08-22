import type { AuditSource } from "@/db/schema";

/**
 * Registry of every audit action the app records, shared by the writers (bot
 * and server actions) and the dashboard that renders them.
 *
 * Actions are stored as plain text rather than a database enum, so adding one
 * here is the whole change — no migration. Keys are `<area>.<verb>`; the area
 * doubles as the dashboard's filter grouping.
 */
export const AUDIT_ACTIONS = {
  // --- Ticket lifecycle -----------------------------------------------------
  "ticket.open": { label: "Ticket opened", group: "Tickets", emoji: "🎫" },
  "ticket.close": { label: "Ticket closed", group: "Tickets", emoji: "📪" },
  "ticket.claim": { label: "Ticket claimed", group: "Tickets", emoji: "🙋" },
  "ticket.unclaim": { label: "Ticket released", group: "Tickets", emoji: "🙌" },
  "ticket.rename": { label: "Ticket renamed", group: "Tickets", emoji: "✏️" },
  "ticket.priority": { label: "Priority changed", group: "Tickets", emoji: "🚩" },
  "ticket.switch_panel": { label: "Panel switched", group: "Tickets", emoji: "🔀" },
  "ticket.notes": { label: "Notes thread opened", group: "Tickets", emoji: "🗒️" },
  "ticket.close_request": { label: "Close requested", group: "Tickets", emoji: "⏳" },
  "ticket.oncall_notified": { label: "On-call notified", group: "Tickets", emoji: "🛎️" },

  // --- Configuration --------------------------------------------------------
  "config.guild": { label: "Server settings saved", group: "Configuration", emoji: "⚙️" },
  "config.panel_create": { label: "Panel created", group: "Configuration", emoji: "➕" },
  "config.panel_update": { label: "Panel updated", group: "Configuration", emoji: "✏️" },
  "config.panel_delete": { label: "Panel deleted", group: "Configuration", emoji: "🗑️" },
  "config.multipanel_create": { label: "Multi-panel created", group: "Configuration", emoji: "➕" },
  "config.multipanel_update": { label: "Multi-panel updated", group: "Configuration", emoji: "✏️" },
  "config.multipanel_delete": { label: "Multi-panel deleted", group: "Configuration", emoji: "🗑️" },
  "config.question_create": { label: "Shared question created", group: "Configuration", emoji: "➕" },
  "config.question_update": { label: "Shared question updated", group: "Configuration", emoji: "✏️" },
  "config.question_delete": { label: "Shared question deleted", group: "Configuration", emoji: "🗑️" },
  "config.canned_create": { label: "Canned response created", group: "Configuration", emoji: "➕" },
  "config.canned_update": { label: "Canned response updated", group: "Configuration", emoji: "✏️" },
  "config.canned_delete": { label: "Canned response deleted", group: "Configuration", emoji: "🗑️" },

  // --- Moderation & staffing ------------------------------------------------
  "blacklist.add": { label: "Blacklist entry added", group: "Moderation", emoji: "🚫" },
  "blacklist.remove": { label: "Blacklist entry removed", group: "Moderation", emoji: "✅" },
  "oncall.add": { label: "Added to on-call roster", group: "Moderation", emoji: "➕" },
  "oncall.remove": { label: "Removed from on-call roster", group: "Moderation", emoji: "➖" },
  "oncall.set": { label: "On-call duty changed", group: "Moderation", emoji: "🔔" },

  // --- Automatic ------------------------------------------------------------
  "system.auto_close": { label: "Auto-closed on inactivity", group: "Automatic", emoji: "⏰" },
  "system.category_full": { label: "Category near capacity", group: "Automatic", emoji: "⚠️" },
} as const satisfies Record<
  string,
  { label: string; group: string; emoji: string }
>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/** The filter groups, in the order the dashboard lists them. */
export const AUDIT_GROUPS = [
  "Tickets",
  "Configuration",
  "Moderation",
  "Automatic",
] as const;

export type AuditGroup = (typeof AUDIT_GROUPS)[number];

/** Every action belonging to a group, for the dashboard's group filter. */
export function actionsInGroup(group: AuditGroup): AuditAction[] {
  return (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter(
    (a) => AUDIT_ACTIONS[a].group === group,
  );
}

/**
 * Presentation for an action key. Unknown keys — a row written by a newer
 * version, or an action since removed — degrade to the raw key rather than
 * disappearing from the trail.
 */
export function auditActionMeta(action: string): {
  label: string;
  group: string;
  emoji: string;
} {
  return (
    AUDIT_ACTIONS[action as AuditAction] ?? {
      label: action,
      group: "Other",
      emoji: "•",
    }
  );
}

/** Human label for where a change came from. */
export const AUDIT_SOURCE_LABEL: Record<AuditSource, string> = {
  bot: "Discord",
  dashboard: "Dashboard",
  system: "Automatic",
};
