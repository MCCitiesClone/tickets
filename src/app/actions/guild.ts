"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { GuildMessageTemplates } from "@/db/schema";
import { canManageGuild } from "@/lib/guild-access";
import { isValidTimeZone } from "@/lib/support-hours";
import { getGuild, upsertGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { recordDashboardAudit } from "@/lib/audit-dashboard";
import { guildMessageTemplatesSchema } from "@/lib/validation/message-template";

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
  overflowCategoryIds: z.array(z.string()).optional(),
  autoCreateOverflow: z.boolean().optional(),
  transcriptChannelId: z.string().nullable().optional(),
  dmTranscriptOnClose: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
  logChannelId: z.string().nullable().optional(),
  statusBoardChannelId: z.string().nullable().optional(),
  reportPanelId: z.string().nullable().optional(),
  onCallPingOnOpen: z.boolean().optional(),
  staffRoleIds: z.array(z.string()).optional(),
  welcomeMessage: z.string().max(2000).optional(),
  ticketLimit: z.number().int().min(0).max(100).optional(),
  autoCloseHours: z.number().int().min(0).max(8760).optional(),
  autoCloseWarningHours: z.number().int().min(0).max(8760).optional(),
  autoCloseExcludeClaimed: z.boolean().optional(),
  autoCloseExcludeHighPriority: z.boolean().optional(),
  namingScheme: z.string().min(1).max(100).optional(),
  closeReasons: z.array(z.string().trim().min(1).max(100)).max(25).optional(),
  supportTimezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    // Reject a zone this runtime can't resolve, rather than storing something
    // every later calculation would throw on.
    .refine(isValidTimeZone, "That isn't a recognised timezone.")
    .optional(),
  supportHours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        start: z.string(),
        end: z.string(),
      }),
    )
    .max(50)
    .optional(),
  supportResponseHint: z.string().trim().max(200).nullable().optional(),
  messageTemplates: guildMessageTemplatesSchema.optional(),
});

export type GuildConfigInput = z.infer<typeof configSchema>;

async function authorize(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
}

export async function updateGuildConfig(input: GuildConfigInput) {
  const { guildId, messageTemplates, ...values } = configSchema.parse(input);
  await authorize(guildId);

  const row = await upsertGuild(guildId, {
    ...values,
    // Validated above; the lenient schema's inferred type is structurally
    // looser than the stored type, so cast at this boundary.
    ...(messageTemplates
      ? { messageTemplates: messageTemplates as GuildMessageTemplates }
      : {}),
  });

  await recordDashboardAudit(guildId, "config.guild", "Server settings saved", {
    type: "guild",
    id: guildId,
    // Field names only — the values can contain channel and role IDs an admin
    // may not want mirrored into a second table.
    metadata: { fields: Object.keys(values) },
  });

  revalidatePath(`/dashboard/settings/${guildId}`);
  revalidatePath("/dashboard");
  return row;
}

export async function fetchGuildConfig(guildId: string) {
  await authorize(guildId);
  return getGuild(guildId);
}
