"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { deleteMessage, postPanelMessage } from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import {
  createPanel as createPanelRow,
  deletePanel as deletePanelRow,
  getPanel,
  setPanelMessage,
} from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";

/**
 * Panel server actions. Like guild config, each re-verifies the session and that
 * the user may manage the target guild.
 */

const questionSchema = z.object({
  label: z.string().min(1).max(45),
  style: z.enum(["short", "paragraph"]),
  required: z.boolean(),
  placeholder: z.string().max(100).optional(),
});

const createSchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  title: z.string().min(1).max(256),
  description: z.string().min(1).max(2000),
  buttonLabel: z.string().min(1).max(80),
  buttonEmoji: z.string().max(64).nullable().optional(),
  buttonColor: z.enum(["Primary", "Secondary", "Success", "Danger"]),
  // Up to 5 modal questions asked when a member opens a ticket.
  questions: z.array(questionSchema).max(5).optional().default([]),
});

export type CreatePanelInput = z.infer<typeof createSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

export async function createPanel(input: CreatePanelInput) {
  const data = createSchema.parse(input);
  await authorize(data.guildId);

  // Assign each question a stable id for its modal field customId.
  const questions = data.questions.map((q, i) => ({
    id: `q${i}`,
    label: q.label,
    style: q.style,
    required: q.required,
    placeholder: q.placeholder,
  }));

  // Persist first so we have an ID to encode in the button custom_id.
  const panel = await createPanelRow({
    guildId: data.guildId,
    title: data.title,
    description: data.description,
    buttonLabel: data.buttonLabel,
    buttonEmoji: data.buttonEmoji ?? null,
    buttonColor: data.buttonColor,
    questions,
  });

  try {
    const messageId = await postPanelMessage(data.channelId, panel);
    await setPanelMessage(panel.id, data.channelId, messageId);
  } catch (err) {
    // Posting failed — roll back the row so we don't leave an orphan panel.
    await deletePanelRow(panel.id);
    throw err;
  }

  revalidatePath("/dashboard/panels");
  return panel;
}

export async function deletePanel(panelId: string) {
  await requireSession();
  const panel = await getPanel(panelId);
  if (!panel) return;
  if (!(await canManageGuild(panel.guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }

  if (panel.channelId && panel.messageId) {
    await deleteMessage(panel.channelId, panel.messageId);
  }
  await deletePanelRow(panelId);
  revalidatePath("/dashboard/panels");
}
