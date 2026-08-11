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

/**
 * A question asked in the Discord modal when a member opens a ticket from a
 * panel. Maps to a modal text input (Discord allows up to 5 per modal).
 */
export type PanelQuestion = {
  /** Stable id, used as the modal field's customId. */
  id: string;
  /** Field label (Discord caps at 45 chars). */
  label: string;
  /** Single-line ("short") or multi-line ("paragraph") input. */
  style: "short" | "paragraph";
  placeholder?: string;
  required: boolean;
};

/** An access-control rule: allow or deny a role from opening tickets. */
export type AccessRule = { roleId: string; action: "allow" | "deny" };

/** Default embed colour (Discord blurple, 0x5865F2) as an integer. */
export const DEFAULT_PANEL_COLOR = 0x5865f2;

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
  /** First message inside a new ticket (overrides guild setting). */
  welcomeMessage: text("welcome_message"),
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
