import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { guild } from "./guilds";

/**
 * A ticket "panel" — a message posted in a channel containing a button that
 * members click to open a ticket. A guild can have many panels (e.g. one for
 * "Support", one for "Billing"), each mapping to its own configuration.
 *
 * `messageId` is populated once the panel message has been posted to Discord by
 * the bot; it lets the bot route button clicks back to the right panel.
 */
export const panel = pgTable("panel", {
  id: uuid("id").primaryKey().defaultRandom(),

  guildId: text("guild_id")
    .notNull()
    .references(() => guild.guildId, { onDelete: "cascade" }),

  /** Channel the panel message lives in. */
  channelId: text("channel_id"),
  /** ID of the posted panel message (null until posted). */
  messageId: text("message_id"),

  /** Embed title and body shown to users. */
  title: text("title").notNull().default("Open a ticket"),
  description: text("description")
    .notNull()
    .default("Click the button below to open a support ticket."),

  /** Button appearance. */
  buttonLabel: text("button_label").notNull().default("Open Ticket"),
  buttonEmoji: text("button_emoji"),
  /** Discord ButtonStyle name: Primary | Secondary | Success | Danger. */
  buttonColor: text("button_color").notNull().default("Primary"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Panel = typeof panel.$inferSelect;
export type NewPanel = typeof panel.$inferInsert;
