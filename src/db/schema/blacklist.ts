import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { guild } from "./guilds";

/** A blacklist entry targets either a single user or a whole role. */
export const blacklistTargetType = pgEnum("blacklist_target_type", [
  "user",
  "role",
]);

/**
 * Per-guild blacklist: users (or members holding a blacklisted role) are blocked
 * from opening tickets. Enforced in the bot's open-ticket precheck, and managed
 * from the dashboard or the `/blacklist` staff command.
 *
 * `targetId` is a Discord snowflake — a user ID when `targetType` is "user", a
 * role ID when "role". `addedBy` is a display label for who created the entry
 * (a username/name, not necessarily a snowflake, since it comes from either the
 * bot or the dashboard session).
 */
export const blacklist = pgTable(
  "blacklist",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    guildId: text("guild_id")
      .notNull()
      .references(() => guild.guildId, { onDelete: "cascade" }),

    targetType: blacklistTargetType("target_type").notNull(),
    /** Discord user or role snowflake, per `targetType`. */
    targetId: text("target_id").notNull(),

    /** Optional reason shown to staff (never to the blocked member). */
    reason: text("reason"),

    /** Display label of whoever added the entry (username or dashboard name). */
    addedBy: text("added_by"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("blacklist_guild_target_unique").on(
      t.guildId,
      t.targetType,
      t.targetId,
    ),
  ],
);

export type Blacklist = typeof blacklist.$inferSelect;
export type NewBlacklist = typeof blacklist.$inferInsert;
export type BlacklistTargetType = (typeof blacklistTargetType.enumValues)[number];
