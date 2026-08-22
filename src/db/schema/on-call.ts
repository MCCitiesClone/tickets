import { boolean, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { guild } from "./guilds";

/**
 * Per-guild on-call roster.
 *
 * A row is a staff member who *can* take on-call duty; `active` marks whoever is
 * holding the pager right now. Splitting the two means a server keeps its roster
 * between shifts instead of re-adding people every handover.
 *
 * When a ticket opens and anyone is `active`, the bot notifies them directly
 * (see `guild.onCallPingOnOpen`) so triage doesn't depend on a whole support
 * role noticing. Managed from the dashboard or the `/oncall` command.
 */
export const onCall = pgTable(
  "on_call",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    guildId: text("guild_id")
      .notNull()
      .references(() => guild.guildId, { onDelete: "cascade" }),

    /** Discord user snowflake of the roster member. */
    userId: text("user_id").notNull(),

    /** Whether this member is holding on-call duty right now. */
    active: boolean("active").notNull().default(false),

    /** Free-text note shown beside them on the roster (e.g. "until 17:00 UTC"). */
    note: text("note"),

    /** Display label of whoever last changed the entry (username or dashboard name). */
    updatedBy: text("updated_by"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("on_call_guild_user_unique").on(t.guildId, t.userId)],
);

export type OnCall = typeof onCall.$inferSelect;
export type NewOnCall = typeof onCall.$inferInsert;
