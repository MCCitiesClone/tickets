"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { MessageTemplate } from "@/db/schema";
import { canManageGuild } from "@/lib/guild-access";
import {
  cannedResponseNameTaken,
  createCannedResponse as createRow,
  deleteCannedResponse as deleteRow,
  getCannedResponse,
  updateCannedResponse as updateRow,
} from "@/lib/queries/canned-responses";
import { upsertGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { recordDashboardAudit } from "@/lib/audit-dashboard";
import { messageTemplateSchema } from "@/lib/validation/message-template";

/**
 * Canned-response server actions. Each re-verifies the session and that the
 * caller may manage the target guild, mirroring the panel actions.
 */

// A canned-response name is the autocomplete key: keep it short and free of the
// characters that make Discord autocomplete choices awkward.
const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the response a name.")
  .max(80)
  .regex(/^[\w -]+$/, "Use letters, numbers, spaces, dashes or underscores.");

const fields = {
  name: nameSchema,
  description: z.string().trim().max(200).nullable().optional(),
  accessRoleIds: z.array(z.string()).max(25).optional().default([]),
  template: messageTemplateSchema,
};

const createSchema = z.object({ guildId: z.string().min(1), ...fields });
const updateSchema = z.object({
  guildId: z.string().min(1),
  id: z.string().min(1),
  ...fields,
});

export type CreateCannedResponseInput = z.infer<typeof createSchema>;
export type UpdateCannedResponseInput = z.infer<typeof updateSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

function templateIsEmpty(t: MessageTemplate): boolean {
  const hasContent = Boolean(t.content && t.content.trim());
  return !hasContent && t.embeds.length === 0;
}

export async function createCannedResponse(input: CreateCannedResponseInput) {
  const data = createSchema.parse(input);
  await authorize(data.guildId);

  // The schema is lenient (matches the panel actions); the renderer clamps.
  const template = data.template as MessageTemplate;
  if (templateIsEmpty(template)) {
    throw new Error("Add some message content or an embed before saving.");
  }
  if (await cannedResponseNameTaken(data.guildId, data.name)) {
    throw new Error(`A canned response named "${data.name}" already exists.`);
  }

  // Ensure the guild row exists so the foreign key holds.
  await upsertGuild(data.guildId);

  const row = await createRow({
    guildId: data.guildId,
    name: data.name,
    description: data.description ?? null,
    accessRoleIds: data.accessRoleIds,
    template,
  });
  await recordDashboardAudit(
    data.guildId,
    "config.canned_create",
    `Created canned response "${row.name}"`,
    { type: "canned_response", id: row.id },
  );
  revalidatePath("/dashboard/canned-responses");
  return row;
}

export async function updateCannedResponse(input: UpdateCannedResponseInput) {
  const data = updateSchema.parse(input);
  await authorize(data.guildId);

  const existing = await getCannedResponse(data.id);
  if (!existing || existing.guildId !== data.guildId) {
    throw new Error("Canned response not found.");
  }
  const template = data.template as MessageTemplate;
  if (templateIsEmpty(template)) {
    throw new Error("Add some message content or an embed before saving.");
  }
  if (await cannedResponseNameTaken(data.guildId, data.name, data.id)) {
    throw new Error(`A canned response named "${data.name}" already exists.`);
  }

  const row = await updateRow(data.id, {
    name: data.name,
    description: data.description ?? null,
    accessRoleIds: data.accessRoleIds,
    template,
  });
  if (!row) throw new Error("Canned response not found.");
  await recordDashboardAudit(
    data.guildId,
    "config.canned_update",
    existing.name === row.name
      ? `Updated canned response "${row.name}"`
      : `Renamed canned response "${existing.name}" to "${row.name}"`,
    { type: "canned_response", id: row.id },
  );
  revalidatePath("/dashboard/canned-responses");
  return row;
}

export async function deleteCannedResponse(guildId: string, id: string) {
  await authorize(guildId);
  const existing = await getCannedResponse(id);
  if (!existing || existing.guildId !== guildId) {
    throw new Error("Canned response not found.");
  }
  await deleteRow(id);
  await recordDashboardAudit(
    guildId,
    "config.canned_delete",
    `Deleted canned response "${existing.name}"`,
    { type: "canned_response", id },
  );
  revalidatePath("/dashboard/canned-responses");
}
