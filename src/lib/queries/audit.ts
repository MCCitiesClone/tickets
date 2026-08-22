import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, type AuditLog, type NewAuditLog } from "@/db/schema";

/**
 * Shared data access for the audit trail. Writes come from the bot and the
 * dashboard's server actions; reads are the dashboard's Audit log page.
 */

/**
 * Append an audit row. Deliberately swallows its own errors: an audit write must
 * never be the reason a ticket fails to open or a settings save fails. A dropped
 * row is logged to the console so it's still visible in the process output.
 */
export async function recordAuditEvent(values: NewAuditLog): Promise<void> {
  try {
    await db.insert(auditLog).values(values);
  } catch (err) {
    console.error("Failed to record audit event:", values.action, err);
  }
}

export type AuditFilters = {
  /** Restrict to these action keys (empty/omitted = all). */
  actions?: string[];
  /** Restrict to one actor's Discord user ID. */
  actorId?: string;
  /** Inclusive lower bound on `createdAt`. */
  from?: Date;
  /** Exclusive upper bound on `createdAt`. */
  to?: Date;
};

export type AuditPage = {
  entries: AuditLog[];
  /** Total matching the filters, for the pager. */
  total: number;
};

function whereFor(guildId: string, filters: AuditFilters) {
  return and(
    eq(auditLog.guildId, guildId),
    filters.actions?.length ? inArray(auditLog.action, filters.actions) : undefined,
    filters.actorId ? eq(auditLog.actorId, filters.actorId) : undefined,
    filters.from ? gte(auditLog.createdAt, filters.from) : undefined,
    filters.to ? lt(auditLog.createdAt, filters.to) : undefined,
  );
}

/** One page of a guild's audit trail, newest first, plus the total match count. */
export async function listAuditLog(
  guildId: string,
  filters: AuditFilters = {},
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<AuditPage> {
  const where = whereFor(guildId, filters);
  const [entries, [count]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(auditLog)
      .where(where),
  ]);
  return { entries, total: count?.total ?? 0 };
}

/**
 * Distinct actors present in a guild's trail, for the actor filter's options.
 * Uses the snapshotted name, so someone who has since left is still selectable.
 */
export async function listAuditActors(
  guildId: string,
): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .selectDistinctOn([auditLog.actorId], {
      id: auditLog.actorId,
      name: auditLog.actorName,
    })
    .from(auditLog)
    .where(and(eq(auditLog.guildId, guildId), sql`${auditLog.actorId} is not null`))
    .orderBy(auditLog.actorId, desc(auditLog.createdAt));

  return rows
    .flatMap((r) => (r.id ? [{ id: r.id, name: r.name ?? r.id }] : []))
    .sort((a, b) => a.name.localeCompare(b.name));
}
