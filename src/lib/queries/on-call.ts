import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { onCall, type OnCall } from "@/db/schema";

/**
 * Shared data access for the per-guild on-call roster, used by both the
 * dashboard server actions and the bot (`/oncall` plus the open-ticket ping).
 *
 * Rows are unique per `(guildId, userId)`, so joining the roster and going on
 * call are the same upsert from the caller's point of view.
 */

/** A guild's whole roster: whoever is on call first, then by join order. */
export async function listOnCall(guildId: string): Promise<OnCall[]> {
  return db
    .select()
    .from(onCall)
    .where(eq(onCall.guildId, guildId))
    .orderBy(desc(onCall.active), asc(onCall.createdAt));
}

/** Just the members currently holding on-call duty. */
export async function listActiveOnCall(guildId: string): Promise<OnCall[]> {
  return db
    .select()
    .from(onCall)
    .where(and(eq(onCall.guildId, guildId), eq(onCall.active, true)))
    .orderBy(asc(onCall.createdAt));
}

/** A single roster entry, or null if the member isn't on the roster. */
export async function getOnCallEntry(
  guildId: string,
  userId: string,
): Promise<OnCall | null> {
  const [row] = await db
    .select()
    .from(onCall)
    .where(and(eq(onCall.guildId, guildId), eq(onCall.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Add a member to the roster, or update them if they're already on it. Used for
 * both "add to roster" (`active: false`) and "go on call" (`active: true`) —
 * claiming duty auto-enrolls, so nobody has to be added first.
 */
export async function upsertOnCallEntry(values: {
  guildId: string;
  userId: string;
  active: boolean;
  note?: string | null;
  updatedBy?: string | null;
}): Promise<OnCall> {
  const [row] = await db
    .insert(onCall)
    .values(values)
    .onConflictDoUpdate({
      target: [onCall.guildId, onCall.userId],
      set: {
        active: values.active,
        note: values.note ?? null,
        updatedBy: values.updatedBy ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

/** Remove a member from the roster entirely. Returns null if they weren't on it. */
export async function removeOnCallEntry(
  guildId: string,
  userId: string,
): Promise<OnCall | null> {
  const [row] = await db
    .delete(onCall)
    .where(and(eq(onCall.guildId, guildId), eq(onCall.userId, userId)))
    .returning();
  return row ?? null;
}
