"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  deleteMessage,
  editPanelMessage,
  postPanelMessage,
} from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import {
  clearPanelMessage,
  createPanel as createPanelRow,
  deletePanel as deletePanelRow,
  getPanel,
  resetCooldowns as resetCooldownsQuery,
  setPanelMessage,
  updatePanel as updatePanelRow,
} from "@/lib/queries/panels";
import {
  MAX_QUESTION_OPTIONS,
  type MessageTemplate,
  type Panel,
  type PanelQuestion,
} from "@/db/schema";
import { requireSession } from "@/lib/session";
import { recordDashboardAudit } from "@/lib/audit-dashboard";
import { messageTemplateSchema } from "@/lib/validation/message-template";

/**
 * Panel server actions. Each re-verifies the session and that the user may
 * manage the target guild.
 */

const questionOptionSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  description: z.string().max(100).optional(),
});

/**
 * A question is either free text or a dropdown, discriminated on `style`. The
 * two text styles keep the values they always had, so panels saved before
 * dropdowns existed still validate.
 */
const questionSchema = z.discriminatedUnion("style", [
  z.object({
    label: z.string().min(1).max(45),
    style: z.enum(["short", "paragraph"]),
    required: z.boolean(),
    placeholder: z.string().max(100).optional(),
  }),
  z.object({
    label: z.string().min(1).max(45),
    style: z.literal("select"),
    required: z.boolean(),
    placeholder: z.string().max(100).optional(),
    options: z.array(questionOptionSchema).min(1).max(MAX_QUESTION_OPTIONS),
    multiple: z.boolean(),
  }),
]);

const accessRuleSchema = z.object({
  roleId: z.string().min(1),
  action: z.enum(["allow", "deny"]),
});

// Fields shared by create and edit. Optional/nullable fields fall back to
// server defaults when null.
const panelFields = {
  // Null = don't post the panel anywhere (e.g. only used in a multi-panel).
  channelId: z.string().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1024),
  color: z.number().int().min(0).max(0xffffff),
  largeImageUrl: z.string().max(2048).nullable().optional(),
  smallImageUrl: z.string().max(2048).nullable().optional(),
  buttonLabel: z.string().min(1).max(80),
  buttonEmoji: z.string().max(64).nullable().optional(),
  buttonColor: z.enum(["Primary", "Secondary", "Success", "Danger"]),
  disabled: z.boolean().optional().default(false),
  categoryId: z.string().nullable().optional(),
  namingScheme: z.string().max(100).nullable().optional(),
  welcomeMessage: z.string().max(4096).nullable().optional(),
  welcomeTemplate: messageTemplateSchema.nullable().optional(),
  supportRoleIds: z.array(z.string()).optional().default([]),
  mentionRoleIds: z.array(z.string()).optional().default([]),
  cooldownSeconds: z.number().int().min(0).max(86_400).optional().default(0),
  hideClaim: z.boolean().optional().default(false),
  hideClose: z.boolean().optional().default(false),
  hideCloseWithReason: z.boolean().optional().default(false),
  accessControl: z.array(accessRuleSchema).max(25).optional().default([]),
  sharedQuestionIds: z.array(z.string().min(1)).max(5).optional().default([]),
  questions: z.array(questionSchema).max(5).optional().default([]),
};

const createSchema = z.object({ guildId: z.string().min(1), ...panelFields });
const updateSchema = z.object({
  guildId: z.string().min(1),
  panelId: z.string().min(1),
  ...panelFields,
});

export type CreatePanelInput = z.infer<typeof createSchema>;
export type UpdatePanelInput = z.infer<typeof updateSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

const emptyToNull = (v: string | null | undefined) => (v ? v : null);

// Shape the validated input into the DB row columns.
function toRow(data: z.infer<typeof createSchema>) {
  return {
    guildId: data.guildId,
    title: data.title,
    description: data.description,
    color: data.color,
    largeImageUrl: emptyToNull(data.largeImageUrl),
    smallImageUrl: emptyToNull(data.smallImageUrl),
    buttonLabel: data.buttonLabel,
    buttonEmoji: emptyToNull(data.buttonEmoji),
    buttonColor: data.buttonColor,
    disabled: data.disabled,
    categoryId: emptyToNull(data.categoryId),
    namingScheme: emptyToNull(data.namingScheme),
    welcomeMessage: emptyToNull(data.welcomeMessage),
    welcomeTemplate: (data.welcomeTemplate ?? null) as MessageTemplate | null,
    supportRoleIds: data.supportRoleIds,
    mentionRoleIds: data.mentionRoleIds,
    cooldownSeconds: data.cooldownSeconds,
    hideClaim: data.hideClaim,
    hideClose: data.hideClose,
    hideCloseWithReason: data.hideCloseWithReason,
    accessControl: data.accessControl,
    sharedQuestionIds: data.sharedQuestionIds,
    questions: data.questions.map((q, i): PanelQuestion => {
      const base = {
        id: `q${i}`,
        label: q.label,
        required: q.required,
        placeholder: q.placeholder,
      };
      return q.style === "select"
        ? { ...base, style: "select", options: q.options, multiple: q.multiple }
        : { ...base, style: q.style };
    }),
  };
}

export async function createPanel(input: CreatePanelInput) {
  const data = createSchema.parse(input);
  await authorize(data.guildId);

  // Persist first so we have an ID to encode in the button custom_id.
  const panel = await createPanelRow(toRow(data));

  // A panel can be created without a channel (used only inside a multi-panel).
  if (data.channelId) {
    try {
      const messageId = await postPanelMessage(data.channelId, panel);
      await setPanelMessage(panel.id, data.channelId, messageId);
    } catch (err) {
      // Posting failed — roll back the row so we don't leave an orphan panel.
      console.error("Failed to post panel message:", err);
      await deletePanelRow(panel.id);
      throw err;
    }
  }

  await recordDashboardAudit(
    data.guildId,
    "config.panel_create",
    `Created panel "${panel.title}"`,
    { type: "panel", id: panel.id, metadata: { channelId: data.channelId ?? null } },
  );
  revalidatePath("/dashboard/panels");
  return panel;
}

export async function updatePanel(input: UpdatePanelInput) {
  const data = updateSchema.parse(input);
  await authorize(data.guildId);

  const existing = await getPanel(data.panelId);
  if (!existing || existing.guildId !== data.guildId) {
    throw new Error("Panel not found.");
  }

  const updated = await updatePanelRow(data.panelId, toRow(data));
  if (!updated) throw new Error("Panel not found.");

  const hadMessage = Boolean(existing.channelId && existing.messageId);

  if (!data.channelId) {
    // Panel should no longer be posted anywhere — remove any existing message.
    if (hadMessage) {
      await deleteMessage(existing.channelId!, existing.messageId!);
      await clearPanelMessage(updated.id);
    }
  } else if (hadMessage && existing.channelId === data.channelId) {
    // Edit in place; if the message was deleted in Discord, re-post it.
    try {
      await editPanelMessage(existing.channelId!, existing.messageId!, updated);
    } catch (err) {
      console.error("Panel message edit failed; re-posting:", err);
      const messageId = await postPanelMessage(data.channelId, updated);
      await setPanelMessage(updated.id, data.channelId, messageId);
    }
  } else {
    // New channel (or first time posting) — delete any old message, then post.
    if (hadMessage) {
      await deleteMessage(existing.channelId!, existing.messageId!);
    }
    const messageId = await postPanelMessage(data.channelId, updated);
    await setPanelMessage(updated.id, data.channelId, messageId);
  }

  await recordDashboardAudit(
    data.guildId,
    "config.panel_update",
    `Updated panel "${updated.title}"`,
    { type: "panel", id: updated.id },
  );
  revalidatePath("/dashboard/panels");
  return updated;
}

/** Re-post the panel's message to Discord (e.g. after it was deleted there). */
export async function resendPanel(panelId: string) {
  const panel = await requirePanel(panelId);
  if (!panel.channelId) throw new Error("Panel has no channel.");

  if (panel.messageId) {
    await deleteMessage(panel.channelId, panel.messageId);
  }
  const messageId = await postPanelMessage(panel.channelId, panel);
  await setPanelMessage(panel.id, panel.channelId, messageId);
  revalidatePath("/dashboard/panels");
}

/** Clear all active cooldowns for a panel. */
export async function resetPanelCooldowns(panelId: string): Promise<number> {
  const panel = await requirePanel(panelId);
  const cleared = await resetCooldownsQuery(panel.id);
  return cleared;
}

export async function deletePanel(panelId: string) {
  const panel = await requirePanel(panelId);
  if (panel.channelId && panel.messageId) {
    await deleteMessage(panel.channelId, panel.messageId);
  }
  await deletePanelRow(panelId);
  await recordDashboardAudit(
    panel.guildId,
    "config.panel_delete",
    `Deleted panel "${panel.title}"`,
    { type: "panel", id: panel.id },
  );
  revalidatePath("/dashboard/panels");
}

async function requirePanel(panelId: string): Promise<Panel> {
  await requireSession();
  const panel = await getPanel(panelId);
  if (!panel) throw new Error("Panel not found.");
  if (!(await canManageGuild(panel.guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
  return panel;
}
