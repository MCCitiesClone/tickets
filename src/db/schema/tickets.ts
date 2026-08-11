import {
  bigint,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { guild } from "./guilds";
import { panel } from "./panels";

export const ticketStatus = pgEnum("ticket_status", ["open", "closed"]);

/**
 * A single support ticket. In this bot each ticket is backed by a dedicated
 * private Discord channel (channel-based model) created under the guild's
 * configured ticket category.
 *
 * `number` is a per-guild incrementing counter used in channel names
 * ("ticket-42"); it is assigned by the bot when the ticket is opened.
 *
 * NOTE (scaffold): the open/close lifecycle that populates and mutates these
 * rows is not implemented yet — see `src/bot/events/interactionCreate.ts`.
 */
export const ticket = pgTable("ticket", {
  id: uuid("id").primaryKey().defaultRandom(),

  guildId: text("guild_id")
    .notNull()
    .references(() => guild.guildId, { onDelete: "cascade" }),

  /** Per-guild sequential ticket number. */
  number: integer("number").notNull(),

  /** The Discord channel that IS this ticket. */
  channelId: text("channel_id").notNull(),

  /** Discord user ID of the member who opened the ticket. */
  openerId: text("opener_id").notNull(),

  /** Panel the ticket was opened from, if any. */
  panelId: uuid("panel_id").references(() => panel.id, { onDelete: "set null" }),

  status: ticketStatus("status").notNull().default("open"),

  /** Discord user ID of the staff member who claimed the ticket. */
  claimedBy: text("claimed_by"),

  /** Answers the opener gave to the panel's form questions (may be empty). */
  formResponses: jsonb("form_responses")
    .$type<{ question: string; answer: string }[]>()
    .notNull()
    .default([]),

  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  /** Discord user ID of whoever closed the ticket. */
  closedBy: text("closed_by"),
});

/**
 * Archived messages captured for a ticket transcript.
 *
 * NOTE (scaffold): transcript capture/rendering is a later iteration. This
 * table defines where captured messages will live so the feature drops in
 * cleanly. `authorId` is the Discord user ID; `authorTag` snapshots the
 * display name at send time.
 */
export const ticketMessage = pgTable("ticket_message", {
  id: uuid("id").primaryKey().defaultRandom(),

  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => ticket.id, { onDelete: "cascade" }),

  /** Discord message snowflake. */
  discordMessageId: bigint("discord_message_id", { mode: "bigint" }),

  authorId: text("author_id").notNull(),
  authorTag: text("author_tag").notNull(),
  content: text("content").notNull().default(""),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
