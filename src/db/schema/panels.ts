import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { guild } from "./guilds";
import type { MessageTemplate } from "./message-template";

/** One choice in a dropdown question. */
export type PanelQuestionOption = {
  /** Shown in the dropdown and recorded as the answer. */
  label: string;
  /** Stable value stored on the option; the label is what's displayed. */
  value: string;
  /** Optional second line under the label. */
  description?: string;
};

/** Fields every question has, whatever its style. */
type PanelQuestionBase = {
  /** Stable id, used as the modal field's customId. */
  id: string;
  /** Field label (Discord caps at 45 chars). */
  label: string;
  placeholder?: string;
  required: boolean;
};

/** A free-text question: single-line ("short") or multi-line ("paragraph"). */
export type PanelTextQuestion = PanelQuestionBase & {
  style: "short" | "paragraph";
};

/**
 * A dropdown question. `multiple` decides the semantics: off is a single
 * choice (a radio group), on lets the member pick several (a checkbox group).
 * Discord has no checkbox or radio component available to modals in the
 * supported discord.js version, so a select covers both.
 */
export type PanelSelectQuestion = PanelQuestionBase & {
  style: "select";
  /** Up to 25, matching Discord's per-select limit. */
  options: PanelQuestionOption[];
  multiple: boolean;
};

/**
 * A question asked in the Discord modal when a member opens a ticket from a
 * panel (Discord allows up to 5 per modal).
 *
 * `style` is the discriminant, and the two text styles keep the values they
 * always had — so questions written before dropdowns existed are still valid
 * without a migration.
 */
export type PanelQuestion = PanelTextQuestion | PanelSelectQuestion;

/** Narrowing helper, since `style` is the discriminant. */
export function isSelectQuestion(q: PanelQuestion): q is PanelSelectQuestion {
  return q.style === "select";
}

/** Discord's cap on options in a single select menu. */
export const MAX_QUESTION_OPTIONS = 25;

/** An access-control rule: allow or deny a role from opening tickets. */
export type AccessRule = { roleId: string; action: "allow" | "deny" };

/** Default embed colour (Discord blurple, 0x5865F2) as an integer. */
export const DEFAULT_PANEL_COLOR = 0x5865f2;

/** Fallback placeholder shown on a multi-panel's dropdown when none is set. */
export const DEFAULT_MULTI_PANEL_PLACEHOLDER = "Select a ticket type…";

/**
 * A ticket "panel" — a message posted in a channel containing a button that
 * members click to open a ticket. A guild can have many panels (e.g. one for
 * "Support", one for "Billing"), each with its own configuration that overrides
 * the server defaults.
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
  /** Embed accent colour (integer). */
  color: integer("color").notNull().default(DEFAULT_PANEL_COLOR),
  /** Optional images shown on the panel embed. */
  largeImageUrl: text("large_image_url"),
  smallImageUrl: text("small_image_url"),

  /** Button appearance. */
  buttonLabel: text("button_label").notNull().default("Open Ticket"),
  buttonEmoji: text("button_emoji"),
  /** Discord ButtonStyle name: Primary | Secondary | Success | Danger. */
  buttonColor: text("button_color").notNull().default("Primary"),

  /** If true, the button is shown but opening is blocked. */
  disabled: boolean("disabled").notNull().default(false),

  // --- Per-panel overrides (null/empty = fall back to server settings) -----
  /** Category new ticket channels are created under (overrides guild setting). */
  categoryId: text("category_id"),
  /** Channel naming scheme (overrides guild setting). */
  namingScheme: text("naming_scheme"),
  /** First message inside a new ticket (legacy plain-text; overrides guild). */
  welcomeMessage: text("welcome_message"),
  /**
   * Rich welcome message for tickets from this panel, designed in the embed
   * editor. When set (non-empty), it overrides both the guild's welcome
   * template and the legacy `welcomeMessage`.
   */
  welcomeTemplate: jsonb("welcome_template").$type<MessageTemplate | null>(),
  /** Staff roles granted access to tickets from this panel (overrides guild). */
  supportRoleIds: jsonb("support_role_ids")
    .$type<string[]>()
    .notNull()
    .default([]),
  /** Roles pinged when a ticket opens (in addition to the opener). */
  mentionRoleIds: jsonb("mention_role_ids")
    .$type<string[]>()
    .notNull()
    .default([]),

  // --- Behaviour ------------------------------------------------------------
  /** Per-user, per-panel cooldown in seconds (0 = disabled). Staff exempt. */
  cooldownSeconds: integer("cooldown_seconds").notNull().default(0),
  /** Ordered allow/deny rules evaluated top-to-bottom, first match wins. */
  accessControl: jsonb("access_control")
    .$type<AccessRule[]>()
    .notNull()
    .default([]),

  /** Ticket-message button visibility overrides. */
  hideClaim: boolean("hide_claim").notNull().default(false),
  hideClose: boolean("hide_close").notNull().default(false),
  hideCloseWithReason: boolean("hide_close_with_reason")
    .notNull()
    .default(false),

  /** Questions asked in a modal when opening a ticket (max 5, may be empty). */
  questions: jsonb("questions")
    .$type<PanelQuestion[]>()
    .notNull()
    .default([]),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * A "multi-panel" combines several individual panels into one embed. Members
 * pick a ticket type via buttons (each reusing the panel's `open_ticket:<id>`
 * button) or a dropdown menu.
 */
export const multiPanel = pgTable("multi_panel", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id")
    .notNull()
    .references(() => guild.guildId, { onDelete: "cascade" }),
  channelId: text("channel_id"),
  messageId: text("message_id"),
  title: text("title").notNull().default("Open a ticket"),
  description: text("description")
    .notNull()
    .default("Select the type of ticket you'd like to open below."),
  color: integer("color").notNull().default(DEFAULT_PANEL_COLOR),
  largeImageUrl: text("large_image_url"),
  smallImageUrl: text("small_image_url"),
  /**
   * Rich message designed in the embed editor. When set (non-empty), it
   * replaces the simple `title`/`description`/`color`/image embed above — the
   * selector buttons/dropdown are still appended. The simple fields are kept as
   * a fallback for multi-panels created before the editor existed.
   */
  messageTemplate: jsonb("message_template").$type<MessageTemplate | null>(),
  /** Show the options as a dropdown (true) or buttons (false). */
  useDropdown: boolean("use_dropdown").notNull().default(false),
  /** Placeholder text on the dropdown (null = built-in default). */
  dropdownPlaceholder: text("dropdown_placeholder"),
  /** Ordered ids of the panels included in this multi-panel. */
  panelIds: jsonb("panel_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MultiPanel = typeof multiPanel.$inferSelect;
export type NewMultiPanel = typeof multiPanel.$inferInsert;

/** Per-user, per-panel cooldown tracking (when a user may next open a ticket). */
export const panelCooldown = pgTable(
  "panel_cooldown",
  {
    panelId: uuid("panel_id")
      .notNull()
      .references(() => panel.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.panelId, t.userId] })],
);

export type Panel = typeof panel.$inferSelect;
export type NewPanel = typeof panel.$inferInsert;
