import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { guild, type Guild, type NewGuild } from "@/db/schema";

/**
 * Shared guild-config data access, used by BOTH the web dashboard (server
 * actions) and the Discord bot. Keep DB access for guild config here so the two
 * runtimes stay in sync.
 */

/** List every configured guild row. */
export async function listGuilds(): Promise<Guild[]> {
  return db.select().from(guild);
}

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

/**
 * Atomically increment and return the guild's ticket counter. Used to assign a
 * unique, monotonic `number` to each new ticket without a read-then-write race.
 */
export async function nextTicketNumber(guildId: string): Promise<number> {
  const [row] = await db
    .update(guild)
    .set({ ticketCounter: sql`${guild.ticketCounter} + 1` })
    .where(eq(guild.guildId, guildId))
    .returning({ n: guild.ticketCounter });
  return row?.n ?? 1;
}
