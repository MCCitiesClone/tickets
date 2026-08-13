import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { panel, ticket, ticketMessage, transcript } from "@/db/schema";

/**
 * Aggregate analytics over `ticket` / `ticket_message` for the dashboard Stats
 * page. Everything is scoped to a guild and a `[from, to)` time window; "opened"
 * metrics filter on `openedAt`, "closed" metrics on `closedAt`.
 */

export type StatsRange = { from: Date; to: Date };

export type StatsSummary = {
  openedInRange: number;
  closedInRange: number;
  currentlyOpen: number;
  avgResolutionSeconds: number | null;
  avgFirstResponseSeconds: number | null;
  respondedCount: number;
  avgRating: number | null;
  ratingCount: number;
};

export type DailyPoint = { date: string; opened: number; closed: number };
export type PanelStat = { name: string; count: number };
export type StaffStat = {
  id: string;
  name: string;
  closed: number;
  claimed: number;
  avgResolutionSeconds: number | null;
};

export type GuildStats = {
  summary: StatsSummary;
  daily: DailyPoint[];
  panels: PanelStat[];
  staff: StaffStat[];
};

const dateKey = (d: Date): string => d.toISOString().slice(0, 10);

/** Zero-filled per-day series from `from` (inclusive) to `to` (exclusive). */
function buildDailySeries(
  { from, to }: StatsRange,
  opened: Map<string, number>,
  closed: Map<string, number>,
): DailyPoint[] {
  const points: DailyPoint[] = [];
  const cur = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  while (cur < to) {
    const key = dateKey(cur);
    points.push({
      date: key,
      opened: opened.get(key) ?? 0,
      closed: closed.get(key) ?? 0,
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return points;
}

/** Resolve staff IDs to their most recent captured display name in the guild. */
async function resolveNames(
  guildId: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([ticketMessage.authorId], {
      id: ticketMessage.authorId,
      name: ticketMessage.authorTag,
    })
    .from(ticketMessage)
    .innerJoin(ticket, eq(ticket.id, ticketMessage.ticketId))
    .where(
      and(eq(ticket.guildId, guildId), inArray(ticketMessage.authorId, ids)),
    )
    .orderBy(ticketMessage.authorId, desc(ticketMessage.createdAt));
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function getSummary(
  guildId: string,
  { from, to }: StatsRange,
): Promise<
  Omit<
    StatsSummary,
    "avgFirstResponseSeconds" | "respondedCount" | "avgRating" | "ratingCount"
  >
> {
  const [row] = await db
    .select({
      openedInRange: sql<number>`count(*) filter (where ${ticket.openedAt} >= ${from} and ${ticket.openedAt} < ${to})::int`,
      closedInRange: sql<number>`count(*) filter (where ${ticket.closedAt} >= ${from} and ${ticket.closedAt} < ${to})::int`,
      currentlyOpen: sql<number>`count(*) filter (where ${ticket.status} = 'open')::int`,
      avgResolutionSeconds: sql<
        number | null
      >`(avg(extract(epoch from (${ticket.closedAt} - ${ticket.openedAt}))) filter (where ${ticket.closedAt} >= ${from} and ${ticket.closedAt} < ${to}))::float8`,
    })
    .from(ticket)
    .where(eq(ticket.guildId, guildId));
  return row;
}

async function getFirstResponse(
  guildId: string,
  { from, to }: StatsRange,
): Promise<{ avg: number | null; responded: number }> {
  // First non-bot message from someone other than the opener = first staff
  // response. LATERAL keeps tickets with no response (null), which avg ignores.
  const result = await db.execute(sql`
    SELECT
      (avg(extract(epoch from (fr.first_response - t.opened_at))))::float8 AS avg,
      count(fr.first_response)::int AS responded
    FROM ${ticket} t
    JOIN LATERAL (
      SELECT min(m.created_at) AS first_response
      FROM ${ticketMessage} m
      WHERE m.ticket_id = t.id
        AND m.author_bot = false
        AND m.author_id <> t.opener_id
    ) fr ON true
    WHERE t.guild_id = ${guildId}
      AND t.opened_at >= ${from}
      AND t.opened_at < ${to}
  `);
  const row = result.rows[0] as
    | { avg: number | null; responded: number }
    | undefined;
  return { avg: row?.avg ?? null, responded: row?.responded ?? 0 };
}

async function getRating(
  guildId: string,
  { from, to }: StatsRange,
): Promise<{ avg: number | null; count: number }> {
  const [row] = await db
    .select({
      avg: sql<number | null>`avg(${transcript.rating})::float8`,
      count: sql<number>`count(${transcript.rating})::int`,
    })
    .from(transcript)
    .innerJoin(ticket, eq(ticket.id, transcript.ticketId))
    .where(
      and(
        eq(ticket.guildId, guildId),
        gte(transcript.createdAt, from),
        lt(transcript.createdAt, to),
      ),
    );
  return { avg: row?.avg ?? null, count: row?.count ?? 0 };
}

async function getDaily(
  guildId: string,
  range: StatsRange,
): Promise<DailyPoint[]> {
  const { from, to } = range;
  const [opened, closed] = await Promise.all([
    db
      .select({
        date: sql<string>`to_char(${ticket.openedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(ticket)
      .where(
        and(
          eq(ticket.guildId, guildId),
          gte(ticket.openedAt, from),
          lt(ticket.openedAt, to),
        ),
      )
      .groupBy(sql`to_char(${ticket.openedAt}, 'YYYY-MM-DD')`),
    db
      .select({
        date: sql<string>`to_char(${ticket.closedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(ticket)
      .where(
        and(
          eq(ticket.guildId, guildId),
          isNotNull(ticket.closedAt),
          gte(ticket.closedAt, from),
          lt(ticket.closedAt, to),
        ),
      )
      .groupBy(sql`to_char(${ticket.closedAt}, 'YYYY-MM-DD')`),
  ]);

  return buildDailySeries(
    range,
    new Map(opened.map((r) => [r.date, r.count])),
    new Map(closed.map((r) => [r.date, r.count])),
  );
}

async function getPanels(
  guildId: string,
  { from, to }: StatsRange,
): Promise<PanelStat[]> {
  const rows = await db
    .select({
      name: sql<string>`coalesce(${panel.title}, 'No panel')`,
      count: sql<number>`count(*)::int`,
    })
    .from(ticket)
    .leftJoin(panel, eq(panel.id, ticket.panelId))
    .where(
      and(
        eq(ticket.guildId, guildId),
        gte(ticket.openedAt, from),
        lt(ticket.openedAt, to),
      ),
    )
    .groupBy(sql`coalesce(${panel.title}, 'No panel')`)
    .orderBy(desc(sql`count(*)`));
  return rows;
}

async function getStaff(
  guildId: string,
  { from, to }: StatsRange,
): Promise<StaffStat[]> {
  const [closedRows, claimedRows] = await Promise.all([
    db
      .select({
        id: ticket.closedBy,
        closed: sql<number>`count(*)::int`,
        avgResolutionSeconds: sql<
          number | null
        >`(avg(extract(epoch from (${ticket.closedAt} - ${ticket.openedAt}))))::float8`,
      })
      .from(ticket)
      .where(
        and(
          eq(ticket.guildId, guildId),
          isNotNull(ticket.closedBy),
          gte(ticket.closedAt, from),
          lt(ticket.closedAt, to),
        ),
      )
      .groupBy(ticket.closedBy),
    db
      .select({
        id: ticket.claimedBy,
        claimed: sql<number>`count(*)::int`,
      })
      .from(ticket)
      .where(
        and(
          eq(ticket.guildId, guildId),
          isNotNull(ticket.claimedBy),
          gte(ticket.openedAt, from),
          lt(ticket.openedAt, to),
        ),
      )
      .groupBy(ticket.claimedBy),
  ]);

  const byId = new Map<string, StaffStat>();
  for (const r of closedRows) {
    if (!r.id) continue;
    byId.set(r.id, {
      id: r.id,
      name: r.id,
      closed: r.closed,
      claimed: 0,
      avgResolutionSeconds: r.avgResolutionSeconds,
    });
  }
  for (const r of claimedRows) {
    if (!r.id) continue;
    const existing = byId.get(r.id);
    if (existing) existing.claimed = r.claimed;
    else
      byId.set(r.id, {
        id: r.id,
        name: r.id,
        closed: 0,
        claimed: r.claimed,
        avgResolutionSeconds: null,
      });
  }

  const names = await resolveNames(guildId, [...byId.keys()]);
  for (const s of byId.values()) s.name = names.get(s.id) ?? s.id;

  return [...byId.values()].sort(
    (a, b) => b.closed - a.closed || b.claimed - a.claimed,
  );
}

/** Everything the Stats page needs, aggregated for one guild + range. */
export async function getGuildStats(
  guildId: string,
  range: StatsRange,
): Promise<GuildStats> {
  const [summary, firstResponse, rating, daily, panels, staff] =
    await Promise.all([
      getSummary(guildId, range),
      getFirstResponse(guildId, range),
      getRating(guildId, range),
      getDaily(guildId, range),
      getPanels(guildId, range),
      getStaff(guildId, range),
    ]);

  return {
    summary: {
      ...summary,
      avgFirstResponseSeconds: firstResponse.avg,
      respondedCount: firstResponse.responded,
      avgRating: rating.avg,
      ratingCount: rating.count,
    },
    daily,
    panels,
    staff,
  };
}
