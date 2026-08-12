import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
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

  /** Private staff-only notes thread attached to this ticket, if created. */
  notesThreadId: text("notes_thread_id"),

  // --- Close request (via /closerequest) -----------------------------------
  /** Discord user ID who requested the close; null when there's no request. */
  closeRequestedBy: text("close_requested_by"),
  /** Reason attached to the pending close request, if any. */
  closeRequestReason: text("close_request_reason"),
  /** When to auto-close if the request goes unconfirmed (null = never). */
  closeRequestExpiresAt: timestamp("close_request_expires_at"),

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

/** A file attached to a captured message (snapshot of Discord's CDN URLs). */
export type TranscriptAttachment = {
  id: string;
  url: string;
  name: string;
  contentType: string | null;
  width: number | null;
  height: number | null;
  size: number;
};

export type TranscriptEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

/** A cleaned-up subset of a Discord embed, enough to re-render it faithfully. */
export type TranscriptEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  author?: { name: string; iconUrl?: string; url?: string };
  fields?: TranscriptEmbedField[];
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string; iconUrl?: string };
  timestamp?: string;
};

/** A resolved mention so the viewer can render `<@id>` as a readable name. */
export type TranscriptMention = {
  id: string;
  name: string;
  type: "user" | "role" | "channel";
};

/**
 * Archived messages captured for a ticket transcript. Rows are written in real
 * time by the bot's message listeners and backfilled by an on-close history
 * sweep (upserted on `(ticketId, discordMessageId)`).
 *
 * `authorId` is the Discord user ID; `authorTag`/`authorAvatarUrl` snapshot the
 * author's display name and avatar at send time. `createdAt` is the Discord
 * message timestamp (the render sort key), not the DB insert time.
 */
export const ticketMessage = pgTable(
  "ticket_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),

    /** Discord message snowflake (stored as text to avoid BigInt in the UI). */
    discordMessageId: text("discord_message_id"),

    authorId: text("author_id").notNull(),
    authorTag: text("author_tag").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    authorBot: boolean("author_bot").notNull().default(false),

    content: text("content").notNull().default(""),

    attachments: jsonb("attachments")
      .$type<TranscriptAttachment[]>()
      .notNull()
      .default([]),
    embeds: jsonb("embeds").$type<TranscriptEmbed[]>().notNull().default([]),
    mentions: jsonb("mentions")
      .$type<TranscriptMention[]>()
      .notNull()
      .default([]),

    /** Discord message ID this message replied to, if any. */
    replyToId: text("reply_to_id"),

    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),

    /** The Discord message's creation time (render sort key). */
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.ticketId, t.discordMessageId)],
);

/**
 * One transcript per ticket, created when the ticket closes. `token` is an
 * unguessable slug used for the public share URL (`/transcripts/<token>`).
 * `closeReason` is snapshotted here since it isn't stored on the ticket.
 */
export const transcript = pgTable("transcript", {
  id: uuid("id").primaryKey().defaultRandom(),

  ticketId: uuid("ticket_id")
    .notNull()
    .unique()
    .references(() => ticket.id, { onDelete: "cascade" }),

  guildId: text("guild_id")
    .notNull()
    .references(() => guild.guildId, { onDelete: "cascade" }),

  /** Unguessable share slug for the public transcript URL. */
  token: text("token").notNull().unique(),

  closeReason: text("close_reason"),

  messageCount: integer("message_count").notNull().default(0),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Ticket = typeof ticket.$inferSelect;
export type NewTicket = typeof ticket.$inferInsert;
export type TicketMessage = typeof ticketMessage.$inferSelect;
export type NewTicketMessage = typeof ticketMessage.$inferInsert;
export type Transcript = typeof transcript.$inferSelect;
export type NewTranscript = typeof transcript.$inferInsert;
