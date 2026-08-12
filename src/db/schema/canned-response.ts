import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { guild } from "./guilds";
import type { MessageTemplate } from "./message-template";

/**
 * A "canned response" — a saved, reusable staff reply that can be posted into a
 * channel with `/cannedresponse`. The body reuses the same `MessageTemplate`
 * shape as the guild message templates, so the dashboard embed editor and the
 * bot's `renderTemplate` both work unchanged. `name` is the short key staff pick
 * from autocomplete and is unique per guild.
 */
export const cannedResponse = pgTable(
  "canned_response",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    guildId: text("guild_id")
      .notNull()
      .references(() => guild.guildId, { onDelete: "cascade" }),

    /** Short unique key shown in autocomplete (e.g. "refund-faq"). */
    name: text("name").notNull(),
    /** Optional one-line summary shown in the picker and dashboard. */
    description: text("description"),

    /** The message body (content + embeds), designed in the embed editor. */
    template: jsonb("template")
      .$type<MessageTemplate>()
      .notNull()
      .default({ embeds: [] }),

    /**
     * Roles permitted to use this response. Empty = any staff member. A member
     * with Manage Channels can always use it.
     */
    accessRoleIds: jsonb("access_role_ids")
      .$type<string[]>()
      .notNull()
      .default([]),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("canned_response_guild_name_unique").on(t.guildId, t.name)],
);

export type CannedResponse = typeof cannedResponse.$inferSelect;
export type NewCannedResponse = typeof cannedResponse.$inferInsert;
