"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getGuild, upsertGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";

/**
 * Server actions for guild configuration.
 *
 * SECURITY: server actions are reachable by direct POST, so each one
 * re-verifies the session with `requireSession()`. (The `proxy.ts` cookie check
 * is only an optimistic redirect.)
 *
 * NOTE (scaffold): this verifies the user is signed in but does NOT yet verify
 * the user actually has Manage-Server permission on `guildId`. That check
 * (using the Discord `guilds` OAuth scope) is a follow-up before these actions
 * are wired to real inputs.
 */

const configSchema = z.object({
  guildId: z.string().min(1),
  ticketCategoryId: z.string().nullable().optional(),
  transcriptChannelId: z.string().nullable().optional(),
  logChannelId: z.string().nullable().optional(),
  welcomeMessage: z.string().max(2000).optional(),
  ticketLimit: z.number().int().min(0).max(100).optional(),
  namingScheme: z.string().min(1).max(100).optional(),
});

export type GuildConfigInput = z.infer<typeof configSchema>;

export async function updateGuildConfig(input: GuildConfigInput) {
  await requireSession();

  const { guildId, ...values } = configSchema.parse(input);
  const row = await upsertGuild(guildId, values);

  revalidatePath(`/dashboard/${guildId}`);
  revalidatePath("/dashboard");
  return row;
}

export async function fetchGuildConfig(guildId: string) {
  await requireSession();
  return getGuild(guildId);
}
