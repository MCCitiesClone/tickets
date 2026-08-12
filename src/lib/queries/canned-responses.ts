import { and, asc, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  cannedResponse,
  type CannedResponse,
  type NewCannedResponse,
} from "@/db/schema";

/**
 * Shared data access for canned responses, used by both the dashboard server
 * actions and the Discord bot's `/cannedresponse` command + autocomplete.
 */

/** List a guild's canned responses, alphabetically by name. */
export async function listGuildCannedResponses(
  guildId: string,
): Promise<CannedResponse[]> {
  return db
    .select()
    .from(cannedResponse)
    .where(eq(cannedResponse.guildId, guildId))
    .orderBy(asc(cannedResponse.name));
}

export async function getCannedResponse(
  id: string,
): Promise<CannedResponse | null> {
  const [row] = await db
    .select()
    .from(cannedResponse)
    .where(eq(cannedResponse.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * True if another canned response in the guild already uses `name` (case-
 * insensitive). `excludeId` skips the row being edited.
 */
export async function cannedResponseNameTaken(
  guildId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: cannedResponse.id, name: cannedResponse.name })
    .from(cannedResponse)
    .where(
      excludeId
        ? and(
            eq(cannedResponse.guildId, guildId),
            ne(cannedResponse.id, excludeId),
          )
        : eq(cannedResponse.guildId, guildId),
    );
  const lower = name.trim().toLowerCase();
  return rows.some((r) => r.name.toLowerCase() === lower);
}

export async function createCannedResponse(
  values: NewCannedResponse,
): Promise<CannedResponse> {
  const [row] = await db.insert(cannedResponse).values(values).returning();
  return row;
}

export async function updateCannedResponse(
  id: string,
  values: Partial<Omit<NewCannedResponse, "id" | "guildId">>,
): Promise<CannedResponse | null> {
  const [row] = await db
    .update(cannedResponse)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(cannedResponse.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCannedResponse(
  id: string,
): Promise<CannedResponse | null> {
  const [row] = await db
    .delete(cannedResponse)
    .where(eq(cannedResponse.id, id))
    .returning();
  return row ?? null;
}
