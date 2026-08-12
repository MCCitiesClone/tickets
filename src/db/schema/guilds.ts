import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Per-Discord-server (guild) configuration for the tickets bot.
 *
 * There is exactly one row per guild the bot is in. `guildId` is the Discord
 * snowflake, stored as `text` because snowflakes exceed JS safe-integer range
 * and Discord treats them as opaque strings.
 *
 * The dashboard reads/writes this table; the bot reads it when handling
 * interactions (e.g. which category to open ticket channels under).
 */
export const guild = pgTable("guild", {
  /** Discord guild (server) snowflake ID. */
  guildId: text("guild_id").primaryKey(),

  /** Category channel that new ticket channels are created under. */
  ticketCategoryId: text("ticket_category_id"),

  /** Channel where closed-ticket transcripts are posted. */
  transcriptChannelId: text("transcript_channel_id"),

  /** DM the ticket opener a link to the transcript when their ticket closes. */
  dmTranscriptOnClose: boolean("dm_transcript_on_close")
    .notNull()
    .default(false),

  /** Channel for audit/log messages (open, close, claim, …). */
  logChannelId: text("log_channel_id"),

  /** Role IDs granted access to every ticket channel (support staff). */
  staffRoleIds: jsonb("staff_role_ids")
    .$type<string[]>()
    .notNull()
    .default([]),

  /** Message posted as the first message inside a newly opened ticket. */
  welcomeMessage: text("welcome_message")
    .notNull()
    .default("Thanks for opening a ticket! Staff will be with you shortly."),

  /** Max simultaneously-open tickets a single user may have (0 = unlimited). */
  ticketLimit: bigint("ticket_limit", { mode: "number" }).notNull().default(1),

  /**
   * Naming scheme for ticket channels. `{number}` and `{username}` are
   * substituted, e.g. "ticket-{number}" -> "ticket-42".
   */
  namingScheme: text("naming_scheme").notNull().default("ticket-{number}"),

  /**
   * Monotonic per-guild ticket counter. Incremented atomically when a ticket is
   * opened to produce its `number` (see `nextTicketNumber`).
   */
  ticketCounter: integer("ticket_counter").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Guild = typeof guild.$inferSelect;
export type NewGuild = typeof guild.$inferInsert;
