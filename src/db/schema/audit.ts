import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { guild } from "./guilds";

/** Where a change came from — the bot's commands, the dashboard, or a sweep. */
export const auditSource = pgEnum("audit_source", ["bot", "dashboard", "system"]);

/**
 * Durable, queryable trail of everything that changes a guild's tickets or its
 * configuration.
 *
 * This complements the Discord log channel rather than replacing it: the log
 * channel is the at-a-glance feed staff already watch, while these rows survive
 * channel purges, cover dashboard edits the bot never sees, and can be filtered.
 *
 * `action` is plain text rather than an enum so a new event type needs no
 * migration — `src/lib/audit.ts` is the registry of known actions and their
 * labels. `summary` is snapshotted at write time so the trail still reads
 * correctly after the things it names are renamed or deleted.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    guildId: text("guild_id")
      .notNull()
      .references(() => guild.guildId, { onDelete: "cascade" }),

    source: auditSource("source").notNull(),

    /** Registry key, e.g. `ticket.close` (see `AUDIT_ACTIONS`). */
    action: text("action").notNull(),

    /** Discord user ID of whoever acted; null for the bot's own sweeps. */
    actorId: text("actor_id"),
    /** Actor's display name at the time, so the row reads without a lookup. */
    actorName: text("actor_name"),

    /** What was acted on — `ticket`, `panel`, `guild`, … — and its ID. */
    targetType: text("target_type"),
    targetId: text("target_id"),

    /** Human-readable line, mirroring what the log channel shows. */
    summary: text("summary").notNull(),

    /** Extra detail for the row's expanded view (changed fields, reasons, …). */
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // The dashboard always reads one guild's trail newest-first.
  (t) => [index("audit_log_guild_created_idx").on(t.guildId, t.createdAt)],
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type AuditSource = (typeof auditSource.enumValues)[number];
