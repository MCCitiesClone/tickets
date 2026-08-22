"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canManageGuild } from "@/lib/guild-access";
import { upsertGuild } from "@/lib/queries/guild";
import {
  getOnCallEntry,
  removeOnCallEntry,
  upsertOnCallEntry,
} from "@/lib/queries/on-call";
import { requireSession } from "@/lib/session";

/**
 * On-call roster server actions. Each re-verifies the session and that the
 * caller may manage the target guild, mirroring the blacklist actions.
 */

// Discord snowflakes are 17–20 digit numeric strings.
const snowflake = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/, "Enter a valid Discord ID.");

const addSchema = z.object({
  guildId: z.string().min(1),
  userId: snowflake,
});

const setActiveSchema = z.object({
  guildId: z.string().min(1),
  userId: snowflake,
  active: z.boolean(),
  note: z.string().trim().max(100).nullable().optional(),
});

export type AddOnCallInput = z.infer<typeof addSchema>;
export type SetOnCallActiveInput = z.infer<typeof setActiveSchema>;

async function authorize(guildId: string) {
  const session = await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
  return session;
}

/** Add a member to the roster, off call. */
export async function addOnCall(input: AddOnCallInput) {
  const data = addSchema.parse(input);
  const session = await authorize(data.guildId);

  if (await getOnCallEntry(data.guildId, data.userId)) {
    throw new Error("That member is already on the roster.");
  }

  // Ensure the guild row exists so the foreign key holds.
  await upsertGuild(data.guildId);

  const row = await upsertOnCallEntry({
    guildId: data.guildId,
    userId: data.userId,
    active: false,
    updatedBy: session.user.name ?? null,
  });
  revalidatePath("/dashboard/on-call");
  return row;
}

/** Put a roster member on or off call, optionally with a note. */
export async function setOnCallActive(input: SetOnCallActiveInput) {
  const data = setActiveSchema.parse(input);
  const session = await authorize(data.guildId);

  if (!(await getOnCallEntry(data.guildId, data.userId))) {
    throw new Error("That member isn't on the roster.");
  }

  const row = await upsertOnCallEntry({
    guildId: data.guildId,
    userId: data.userId,
    active: data.active,
    note: data.active ? (data.note?.trim() || null) : null,
    updatedBy: session.user.name ?? null,
  });
  revalidatePath("/dashboard/on-call");
  return row;
}

/** Remove a member from the roster entirely. */
export async function removeOnCall(guildId: string, userId: string) {
  await authorize(guildId);
  const existing = await getOnCallEntry(guildId, userId);
  if (!existing) throw new Error("That member isn't on the roster.");
  await removeOnCallEntry(guildId, userId);
  revalidatePath("/dashboard/on-call");
}
