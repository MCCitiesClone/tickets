"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MAX_QUESTION_OPTIONS } from "@/db/schema";
import { recordDashboardAudit } from "@/lib/audit-dashboard";
import { canManageGuild } from "@/lib/guild-access";
import {
  createFormQuestion,
  deleteFormQuestion,
  formQuestionNameTaken,
  getFormQuestion,
  updateFormQuestion,
} from "@/lib/queries/form-questions";
import { upsertGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";

/**
 * Server actions for the guild's shared form-question library. Each re-verifies
 * the session and that the caller may manage the target guild.
 */

const optionSchema = z.object({
  label: z.string().trim().min(1).max(100),
  value: z.string().trim().min(1).max(100),
  description: z.string().trim().max(100).optional(),
});

const fields = {
  name: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(45),
  style: z.enum(["short", "paragraph", "select"]),
  placeholder: z.string().trim().max(100).nullable().optional(),
  required: z.boolean(),
  options: z.array(optionSchema).max(MAX_QUESTION_OPTIONS).default([]),
  multiple: z.boolean().default(false),
};

const createSchema = z.object({ guildId: z.string().min(1), ...fields });
const updateSchema = z.object({
  guildId: z.string().min(1),
  id: z.string().min(1),
  ...fields,
});

export type CreateFormQuestionInput = z.infer<typeof createSchema>;
export type UpdateFormQuestionInput = z.infer<typeof updateSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

/** A dropdown with no choices can't be rendered in a modal. */
function assertUsable(style: string, options: unknown[]) {
  if (style === "select" && options.length === 0) {
    throw new Error("A dropdown question needs at least one choice.");
  }
}

export async function createSharedQuestion(input: CreateFormQuestionInput) {
  const data = createSchema.parse(input);
  await authorize(data.guildId);
  assertUsable(data.style, data.options);

  if (await formQuestionNameTaken(data.guildId, data.name)) {
    throw new Error(`A question named "${data.name}" already exists.`);
  }

  // Ensure the guild row exists so the foreign key holds.
  await upsertGuild(data.guildId);

  const row = await createFormQuestion({
    guildId: data.guildId,
    name: data.name,
    label: data.label,
    style: data.style,
    placeholder: data.placeholder || null,
    required: data.required,
    options: data.style === "select" ? data.options : [],
    multiple: data.style === "select" && data.multiple,
  });

  await recordDashboardAudit(
    data.guildId,
    "config.question_create",
    `Created shared question "${row.name}"`,
    { type: "form_question", id: row.id },
  );
  revalidatePath("/dashboard/questions");
  return row;
}

export async function updateSharedQuestion(input: UpdateFormQuestionInput) {
  const data = updateSchema.parse(input);
  await authorize(data.guildId);
  assertUsable(data.style, data.options);

  const existing = await getFormQuestion(data.id);
  if (!existing || existing.guildId !== data.guildId) {
    throw new Error("Question not found.");
  }
  if (await formQuestionNameTaken(data.guildId, data.name, data.id)) {
    throw new Error(`A question named "${data.name}" already exists.`);
  }

  const row = await updateFormQuestion(data.id, {
    name: data.name,
    label: data.label,
    style: data.style,
    placeholder: data.placeholder || null,
    required: data.required,
    options: data.style === "select" ? data.options : [],
    multiple: data.style === "select" && data.multiple,
  });
  if (!row) throw new Error("Question not found.");

  await recordDashboardAudit(
    data.guildId,
    "config.question_update",
    `Updated shared question "${row.name}"`,
    { type: "form_question", id: row.id },
  );
  revalidatePath("/dashboard/questions");
  revalidatePath("/dashboard/panels");
  return row;
}

export async function deleteSharedQuestion(guildId: string, id: string) {
  await authorize(guildId);
  const existing = await getFormQuestion(id);
  if (!existing || existing.guildId !== guildId) {
    throw new Error("Question not found.");
  }

  await deleteFormQuestion(id);
  await recordDashboardAudit(
    guildId,
    "config.question_delete",
    `Deleted shared question "${existing.name}"`,
    { type: "form_question", id },
  );
  // Panels referencing it simply stop asking it — see `getSharedQuestions`.
  revalidatePath("/dashboard/questions");
  revalidatePath("/dashboard/panels");
}
