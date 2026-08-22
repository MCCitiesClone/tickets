import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  formQuestion,
  type FormQuestion,
  type NewFormQuestion,
  type PanelQuestion,
} from "@/db/schema";

/**
 * The guild-level library of reusable form questions, plus the resolution of a
 * panel's effective question list. Shared by the dashboard and the bot, so both
 * compose a panel's form identically — they must, since the modal's field IDs
 * have to match between showing it and reading it back.
 */

/** Discord allows five fields in a modal, across shared and inline questions. */
export const MAX_PANEL_QUESTIONS = 5;

export async function listFormQuestions(
  guildId: string,
): Promise<FormQuestion[]> {
  return db
    .select()
    .from(formQuestion)
    .where(eq(formQuestion.guildId, guildId))
    .orderBy(asc(formQuestion.name));
}

export async function getFormQuestion(
  id: string,
): Promise<FormQuestion | null> {
  const [row] = await db
    .select()
    .from(formQuestion)
    .where(eq(formQuestion.id, id))
    .limit(1);
  return row ?? null;
}

/** True when another question in the guild already uses this name. */
export async function formQuestionNameTaken(
  guildId: string,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: formQuestion.id })
    .from(formQuestion)
    .where(and(eq(formQuestion.guildId, guildId), eq(formQuestion.name, name)));
  return rows.some((r) => r.id !== exceptId);
}

export async function createFormQuestion(
  values: NewFormQuestion,
): Promise<FormQuestion> {
  const [row] = await db.insert(formQuestion).values(values).returning();
  return row;
}

export async function updateFormQuestion(
  id: string,
  values: Partial<NewFormQuestion>,
): Promise<FormQuestion | null> {
  const [row] = await db
    .update(formQuestion)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(formQuestion.id, id))
    .returning();
  return row ?? null;
}

export async function deleteFormQuestion(
  id: string,
): Promise<FormQuestion | null> {
  const [row] = await db
    .delete(formQuestion)
    .where(eq(formQuestion.id, id))
    .returning();
  return row ?? null;
}

/**
 * Convert a library row into the shape the modal builder consumes. The row's
 * own ID becomes the modal field's customId — stable across edits, and never
 * colliding with a panel's inline `q0`…`q4`.
 */
export function toPanelQuestion(row: FormQuestion): PanelQuestion {
  const base = {
    id: row.id,
    label: row.label,
    required: row.required,
    placeholder: row.placeholder ?? undefined,
  };
  return row.style === "select"
    ? { ...base, style: "select", options: row.options, multiple: row.multiple }
    : { ...base, style: row.style === "paragraph" ? "paragraph" : "short" };
}

/**
 * A panel's effective question list: its shared questions in the order listed,
 * then its own inline ones, capped at Discord's five fields.
 *
 * The single place this is composed. Showing the modal and reading the
 * submission both go through it, so the field IDs can't drift apart between
 * the two — which would silently drop answers.
 */
export async function resolvePanelQuestions(panel: {
  sharedQuestionIds: string[];
  questions: PanelQuestion[];
}): Promise<PanelQuestion[]> {
  const shared = await getSharedQuestions(panel.sharedQuestionIds);
  return [...shared, ...panel.questions].slice(0, MAX_PANEL_QUESTIONS);
}

/** Fetch shared questions by ID, preserving the order they were listed in. */
export async function getSharedQuestions(
  ids: string[],
): Promise<PanelQuestion[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(formQuestion)
    .where(inArray(formQuestion.id, ids));

  const byId = new Map(rows.map((r) => [r.id, r]));
  // Order comes from the panel's list, not the database. A question deleted
  // from the library simply drops out rather than breaking the form.
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toPanelQuestion(row)] : [];
  });
}
