"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createGuildChannel } from "@/lib/discord-api";
import { canManageGuild } from "@/lib/guild-access";
import { requireSession } from "@/lib/session";

const schema = z.object({
  guildId: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: z.enum(["text", "category"]),
  parentId: z.string().nullable().optional(),
});

export type CreateChannelInput = z.infer<typeof schema>;

/**
 * Create a Discord channel (text or category) in a guild the user manages, and
 * return it. Used by the channel picker's "create new channel" modal.
 */
export async function createChannel(input: CreateChannelInput) {
  const data = schema.parse(input);
  await requireSession();
  if (!(await canManageGuild(data.guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }

  const channel = await createGuildChannel(data.guildId, {
    name: data.name,
    type: data.kind,
    parentId: data.parentId ?? null,
  });

  // Server-rendered channel lists (e.g. Settings) should pick up the new one.
  revalidatePath("/dashboard", "layout");
  return channel;
}
