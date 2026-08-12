"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canManageGuild } from "@/lib/guild-access";
import { getGuild, upsertGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";

/**
 * Server actions for guild configuration.
 *
 * SECURITY: server actions are reachable by direct POST, so each one
 * re-verifies the session with `requireSession()` (the `proxy.ts` cookie check
 * is only optimistic) AND that the user may manage the target guild
 * (`canManageGuild` — bot present + user has Manage Server via the Discord
 * `guilds` scope).
 */

const configSchema = z.object({
  guildId: z.string().min(1),
  ticketCategoryId: z.string().nullable().optional(),
  transcriptChannelId: z.string().nullable().optional(),
  dmTranscriptOnClose: z.boolean().optional(),
  logChannelId: z.string().nullable().optional(),
  staffRoleIds: z.array(z.string()).optional(),
  welcomeMessage: z.string().max(2000).optional(),
  ticketLimit: z.number().int().min(0).max(100).optional(),
  namingScheme: z.string().min(1).max(100).optional(),
});

export type GuildConfigInput = z.infer<typeof configSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

export async function updateGuildConfig(input: GuildConfigInput) {
  const { guildId, ...values } = configSchema.parse(input);
  await authorize(guildId);

  const row = await upsertGuild(guildId, values);

  revalidatePath(`/dashboard/settings/${guildId}`);
  revalidatePath("/dashboard");
  return row;
}

export async function fetchGuildConfig(guildId: string) {
  await authorize(guildId);
  return getGuild(guildId);
}
