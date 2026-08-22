"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  deleteMessage,
  editMultiPanelMessage,
  type PanelButtonInput,
  postMultiPanelMessage,
} from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import {
  createMultiPanel as createRow,
  deleteMultiPanel as deleteRow,
  getMultiPanel,
  getPanelsByIds,
  setMultiPanelMessage,
  updateMultiPanel as updateRow,
} from "@/lib/queries/panels";
import { isTemplateEmpty, type MessageTemplate, type MultiPanel } from "@/db/schema";
import { requireSession } from "@/lib/session";
import { recordDashboardAudit } from "@/lib/audit-dashboard";
import { messageTemplateSchema } from "@/lib/validation/message-template";

const fields = {
  channelId: z.string().min(1),
  // Title/description are optional: when a rich `messageTemplate` is set it
  // replaces the simple embed, so the simple fields may be left blank.
  title: z.string().max(255),
  description: z.string().max(1024),
  color: z.number().int().min(0).max(0xffffff),
  largeImageUrl: z.string().max(2048).nullable().optional(),
  smallImageUrl: z.string().max(2048).nullable().optional(),
  messageTemplate: messageTemplateSchema.nullable().optional(),
  useDropdown: z.boolean().optional().default(false),
  dropdownPlaceholder: z.string().max(150).nullable().optional(),
  panelIds: z.array(z.string()).min(1).max(25),
};

/** A multi-panel must render something: a rich template or a simple message. */
function hasMessageBody(d: {
  title: string;
  description: string;
  messageTemplate?: unknown;
}): boolean {
  return (
    !isTemplateEmpty((d.messageTemplate ?? null) as MessageTemplate | null) ||
    d.title.trim().length > 0 ||
    d.description.trim().length > 0
  );
}
const bodyError = {
  message: "Add a message or design a rich embed for the multi-panel.",
  path: ["description"],
};

const createSchema = z
  .object({ guildId: z.string().min(1), ...fields })
  .refine(hasMessageBody, bodyError);
const updateSchema = z
  .object({
    guildId: z.string().min(1),
    multiPanelId: z.string().min(1),
    ...fields,
  })
  .refine(hasMessageBody, bodyError);

export type CreateMultiPanelInput = z.infer<typeof createSchema>;
export type UpdateMultiPanelInput = z.infer<typeof updateSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

const emptyToNull = (v: string | null | undefined) => (v ? v : null);

function toRow(data: z.infer<typeof createSchema>) {
  return {
    guildId: data.guildId,
    title: data.title,
    description: data.description,
    color: data.color,
    largeImageUrl: emptyToNull(data.largeImageUrl),
    smallImageUrl: emptyToNull(data.smallImageUrl),
    messageTemplate: (data.messageTemplate ?? null) as MessageTemplate | null,
    useDropdown: data.useDropdown,
    dropdownPlaceholder: emptyToNull(data.dropdownPlaceholder),
    panelIds: data.panelIds,
  };
}

/** Resolve the included panels (guild-scoped) into button inputs, in order. */
async function panelButtons(
  guildId: string,
  panelIds: string[],
): Promise<PanelButtonInput[]> {
  const panels = await getPanelsByIds(panelIds);
  return panels
    .filter((p) => p.guildId === guildId)
    .map((p) => ({
      id: p.id,
      title: p.title,
      buttonLabel: p.buttonLabel,
      buttonEmoji: p.buttonEmoji,
      buttonColor: p.buttonColor,
    }));
}

export async function createMultiPanel(input: CreateMultiPanelInput) {
  const data = createSchema.parse(input);
  await authorize(data.guildId);

  const buttons = await panelButtons(data.guildId, data.panelIds);
  if (buttons.length === 0) throw new Error("Select at least one valid panel.");

  const mp = await createRow(toRow(data));
  try {
    const messageId = await postMultiPanelMessage(data.channelId, mp, buttons);
    await setMultiPanelMessage(mp.id, data.channelId, messageId);
  } catch (err) {
    console.error("Failed to post multi-panel message:", err);
    await deleteRow(mp.id);
    throw err;
  }

  await recordDashboardAudit(
    data.guildId,
    "config.multipanel_create",
    `Created multi-panel "${mp.title}"`,
    { type: "multi_panel", id: mp.id, metadata: { panels: data.panelIds.length } },
  );
  revalidatePath("/dashboard/panels");
  return mp;
}

export async function updateMultiPanel(input: UpdateMultiPanelInput) {
  const data = updateSchema.parse(input);
  await authorize(data.guildId);

  const existing = await getMultiPanel(data.multiPanelId);
  if (!existing || existing.guildId !== data.guildId) {
    throw new Error("Multi-panel not found.");
  }

  const buttons = await panelButtons(data.guildId, data.panelIds);
  if (buttons.length === 0) throw new Error("Select at least one valid panel.");

  const updated = await updateRow(data.multiPanelId, toRow(data));
  if (!updated) throw new Error("Multi-panel not found.");

  let edited = false;
  if (existing.messageId && existing.channelId === data.channelId) {
    try {
      await editMultiPanelMessage(
        existing.channelId,
        existing.messageId,
        updated,
        buttons,
      );
      edited = true;
    } catch (err) {
      console.error("Multi-panel edit failed; re-posting:", err);
    }
  }
  if (!edited) {
    if (existing.channelId && existing.messageId) {
      await deleteMessage(existing.channelId, existing.messageId);
    }
    const messageId = await postMultiPanelMessage(
      data.channelId,
      updated,
      buttons,
    );
    await setMultiPanelMessage(updated.id, data.channelId, messageId);
  }

  await recordDashboardAudit(
    data.guildId,
    "config.multipanel_update",
    `Updated multi-panel "${updated.title}"`,
    { type: "multi_panel", id: updated.id, metadata: { panels: data.panelIds.length } },
  );
  revalidatePath("/dashboard/panels");
  return updated;
}

export async function resendMultiPanel(multiPanelId: string) {
  const mp = await requireMultiPanel(multiPanelId);
  if (!mp.channelId) throw new Error("Multi-panel has no channel.");
  const buttons = await panelButtons(mp.guildId, mp.panelIds);
  if (mp.messageId) await deleteMessage(mp.channelId, mp.messageId);
  const messageId = await postMultiPanelMessage(mp.channelId, mp, buttons);
  await setMultiPanelMessage(mp.id, mp.channelId, messageId);
  revalidatePath("/dashboard/panels");
}

export async function deleteMultiPanel(multiPanelId: string) {
  const mp = await requireMultiPanel(multiPanelId);
  if (mp.channelId && mp.messageId) {
    await deleteMessage(mp.channelId, mp.messageId);
  }
  await deleteRow(multiPanelId);
  await recordDashboardAudit(
    mp.guildId,
    "config.multipanel_delete",
    `Deleted multi-panel "${mp.title}"`,
    { type: "multi_panel", id: mp.id },
  );
  revalidatePath("/dashboard/panels");
}

async function requireMultiPanel(id: string): Promise<MultiPanel> {
  await requireSession();
  const mp = await getMultiPanel(id);
  if (!mp) throw new Error("Multi-panel not found.");
  if (!(await canManageGuild(mp.guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
  return mp;
}
