import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { GuildMessageTemplates } from "./message-template";

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

  /**
   * Admin-configured fallback categories, tried in order when the primary
   * category (panel override → `ticketCategoryId`) is full. Discord caps a
   * category at 50 channels; without a fallback, ticket creation hard-fails once
   * that's hit. See the bot's `openTicket` overflow resolution.
   */
  overflowCategoryIds: jsonb("overflow_category_ids")
    .$type<string[]>()
    .notNull()
    .default([]),

  /**
   * When every configured category is full, auto-create a fresh overflow
   * category (mirroring the primary's permissions) and route the ticket there,
   * so ticket creation never fails at the channel limit.
   */
  autoCreateOverflow: boolean("auto_create_overflow").notNull().default(true),

  /**
   * Bot-managed: categories the bot auto-created for overflow, in creation
   * order. Tried (and reused as tickets close) after the admin-configured
   * `overflowCategoryIds`, before creating another. Not edited from the
   * dashboard.
   */
  autoOverflowCategoryIds: jsonb("auto_overflow_category_ids")
    .$type<string[]>()
    .notNull()
    .default([]),

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

  /**
   * Legacy plain-text first message inside a new ticket. Used as a fallback when
   * no rich `messageTemplates.welcome` is configured (see `messageTemplates`).
   */
  welcomeMessage: text("welcome_message")
    .notNull()
    .default("Thanks for opening a ticket! Staff will be with you shortly."),

  /**
   * Admin-configured rich system messages (welcome, claim notice, close DM,
   * transcript post) designed in the dashboard embed editor. Absent keys fall
   * back to the bot's built-in defaults.
   */
  messageTemplates: jsonb("message_templates")
    .$type<GuildMessageTemplates>()
    .notNull()
    .default({}),

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
