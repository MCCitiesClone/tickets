import { eq } from "drizzle-orm";

import { db } from "@/db";
import { guild, type Guild, type NewGuild } from "@/db/schema";

/** Fetch a guild's configuration row, or `null` if it hasn't been set up. */
export async function getGuild(guildId: string): Promise<Guild | null> {
  const [row] = await db
    .select()
    .from(guild)
    .where(eq(guild.guildId, guildId))
    .limit(1);
  return row ?? null;
}

/**
 * Create the guild config row if missing, or update the provided fields if it
 * already exists. Returns the resulting row.
 */
export async function upsertGuild(
  guildId: string,
  values: Partial<Omit<NewGuild, "guildId">> = {},
): Promise<Guild> {
  const [row] = await db
    .insert(guild)
    .values({ guildId, ...values })
    .onConflictDoUpdate({
      target: guild.guildId,
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  return row;
}
