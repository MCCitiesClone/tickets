import { and, desc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db";
import {
  blacklist,
  type Blacklist,
  type BlacklistTargetType,
  type NewBlacklist,
} from "@/db/schema";

/**
 * Shared data access for the per-guild blacklist, used by both the dashboard
 * server actions and the bot (the `/blacklist` command + the open-ticket
 * precheck enforcement).
 */

/** List a guild's blacklist entries, newest first. */
export async function listGuildBlacklist(guildId: string): Promise<Blacklist[]> {
  return db
    .select()
    .from(blacklist)
    .where(eq(blacklist.guildId, guildId))
    .orderBy(desc(blacklist.createdAt));
}

export async function getBlacklistEntry(id: string): Promise<Blacklist | null> {
  const [row] = await db
    .select()
    .from(blacklist)
    .where(eq(blacklist.id, id))
    .limit(1);
  return row ?? null;
}

/** Fetch a specific target's entry (for dedupe / `/blacklist remove`). */
export async function getBlacklistTarget(
  guildId: string,
  targetType: BlacklistTargetType,
  targetId: string,
): Promise<Blacklist | null> {
  const [row] = await db
    .select()
    .from(blacklist)
    .where(
      and(
        eq(blacklist.guildId, guildId),
        eq(blacklist.targetType, targetType),
        eq(blacklist.targetId, targetId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * The blacklist entry that blocks this member, if any: a "user" entry matching
 * their id, or a "role" entry matching one of their roles. Returns null when the
 * member isn't blacklisted.
 */
export async function findBlacklistMatch(
  guildId: string,
  userId: string,
  roleIds: string[],
): Promise<Blacklist | null> {
  const targets = [
    and(eq(blacklist.targetType, "user"), eq(blacklist.targetId, userId)),
    roleIds.length > 0
      ? and(
          eq(blacklist.targetType, "role"),
          inArray(blacklist.targetId, roleIds),
        )
      : undefined,
  ];
  const [row] = await db
    .select()
    .from(blacklist)
    .where(and(eq(blacklist.guildId, guildId), or(...targets)))
    .limit(1);
  return row ?? null;
}

export async function addBlacklistEntry(
  values: NewBlacklist,
): Promise<Blacklist> {
  const [row] = await db.insert(blacklist).values(values).returning();
  return row;
}

export async function removeBlacklistEntry(
  id: string,
): Promise<Blacklist | null> {
  const [row] = await db
    .delete(blacklist)
    .where(eq(blacklist.id, id))
    .returning();
  return row ?? null;
}

/** Remove by target (used by `/blacklist remove`). */
export async function removeBlacklistTarget(
  guildId: string,
  targetType: BlacklistTargetType,
  targetId: string,
): Promise<Blacklist | null> {
  const [row] = await db
    .delete(blacklist)
    .where(
      and(
        eq(blacklist.guildId, guildId),
        eq(blacklist.targetType, targetType),
        eq(blacklist.targetId, targetId),
      ),
    )
    .returning();
  return row ?? null;
}
