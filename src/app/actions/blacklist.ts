"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canManageGuild } from "@/lib/guild-access";
import {
  addBlacklistEntry,
  getBlacklistEntry,
  getBlacklistTarget,
  removeBlacklistEntry,
} from "@/lib/queries/blacklist";
import { upsertGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";

/**
 * Blacklist server actions. Each re-verifies the session and that the caller may
 * manage the target guild, mirroring the canned-response and panel actions.
 */

// Discord snowflakes are 17–20 digit numeric strings.
const snowflake = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/, "Enter a valid Discord ID.");

const addSchema = z.object({
  guildId: z.string().min(1),
  targetType: z.enum(["user", "role"]),
  targetId: snowflake,
  reason: z.string().trim().max(500).nullable().optional(),
});

export type AddBlacklistInput = z.infer<typeof addSchema>;

async function authorize(guildId: string) {
  const session = await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
  return session;
}

export async function addBlacklist(input: AddBlacklistInput) {
  const data = addSchema.parse(input);
  const session = await authorize(data.guildId);

  if (
    await getBlacklistTarget(data.guildId, data.targetType, data.targetId)
  ) {
    throw new Error("That user or role is already blacklisted.");
  }

  // Ensure the guild row exists so the foreign key holds.
  await upsertGuild(data.guildId);

  const row = await addBlacklistEntry({
    guildId: data.guildId,
    targetType: data.targetType,
    targetId: data.targetId,
    reason: data.reason?.trim() ? data.reason.trim() : null,
    addedBy: session.user.name ?? null,
  });
  revalidatePath("/dashboard/blacklist");
  return row;
}

export async function removeBlacklist(guildId: string, id: string) {
  await authorize(guildId);
  const existing = await getBlacklistEntry(id);
  if (!existing || existing.guildId !== guildId) {
    throw new Error("Blacklist entry not found.");
  }
  await removeBlacklistEntry(id);
  revalidatePath("/dashboard/blacklist");
}
