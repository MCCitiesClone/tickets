import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { guild } from "./guilds";
import type { PanelQuestionOption } from "./panels";

/**
 * A form question defined once for a guild and reused across panels.
 *
 * Panels reference these by ID (`panel.sharedQuestionIds`) and may still add
 * their own inline questions — see `panel.questions`. The stored shape mirrors
 * `PanelQuestion` so resolving a panel's effective list is a concatenation
 * rather than a translation.
 *
 * `name` is the library's own label for the row, shown when picking questions
 * in the dashboard; `label` is what members actually see in the modal.
 */
export const formQuestion = pgTable("form_question", {
  id: uuid("id").primaryKey().defaultRandom(),

  guildId: text("guild_id")
    .notNull()
    .references(() => guild.guildId, { onDelete: "cascade" }),

  /** How this question is listed in the dashboard's library. */
  name: text("name").notNull(),

  /** Field prompt shown to the member (Discord caps at 45 chars). */
  label: text("label").notNull(),

  /** "short" | "paragraph" | "select" — matches `PanelQuestion["style"]`. */
  style: text("style").notNull().default("short"),

  placeholder: text("placeholder"),
  required: boolean("required").notNull().default(true),

  /** Choices, for a `select` question. Empty for text questions. */
  options: jsonb("options")
    .$type<PanelQuestionOption[]>()
    .notNull()
    .default([]),

  /** Whether a `select` question accepts more than one choice. */
  multiple: boolean("multiple").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FormQuestion = typeof formQuestion.$inferSelect;
export type NewFormQuestion = typeof formQuestion.$inferInsert;
