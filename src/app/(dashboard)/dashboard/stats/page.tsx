import { BarChart3 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getActiveGuild } from "@/lib/active-guild";
import { formatDuration } from "@/lib/duration";
import { getGuildStats } from "@/lib/queries/stats";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { StatsCharts } from "../stats-charts";
import { StatsExport } from "../stats-export";
import { StatsRangeSelect } from "../stats-range-select";

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const DEFAULT_RANGE = "30d";
const DAY_MS = 24 * 60 * 60 * 1000;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireSession();
  const { active } = await getActiveGuild();
  const { range: rangeParam } = await searchParams;
  const range = rangeParam && rangeParam in RANGES ? rangeParam : DEFAULT_RANGE;

  const to = new Date();
  const from = new Date(to.getTime() - RANGES[range] * DAY_MS);

  const stats = active ? await getGuildStats(active.id, { from, to }) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Stats"
        description={
          active
            ? `Ticket activity for ${active.name} over the last ${range.replace("d", " days")}.`
            : "Ticket activity and analytics."
        }
        action={
          active && stats ? (
            <div className="flex items-center gap-2">
              <StatsRangeSelect value={range} />
              <StatsExport stats={stats} range={range} />
            </div>
          ) : active ? (
            <StatsRangeSelect value={range} />
          ) : undefined
        }
      />

      {!active || !stats ? (
        <EmptyState
          icon={<BarChart3 className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Opened" value={String(stats.summary.openedInRange)} />
            <StatCard label="Closed" value={String(stats.summary.closedInRange)} />
            <StatCard
              label="Currently open"
              value={String(stats.summary.currentlyOpen)}
            />
            <StatCard
              label="Avg first response"
              value={formatDuration(stats.summary.avgFirstResponseSeconds)}
              hint={`${stats.summary.respondedCount} of ${stats.summary.openedInRange} answered`}
            />
            <StatCard
              label="Avg resolution"
              value={formatDuration(stats.summary.avgResolutionSeconds)}
              hint={`${stats.summary.closedInRange} closed`}
            />
            <StatCard
              label="Avg rating"
              value={
                stats.summary.avgRating != null
                  ? `${stats.summary.avgRating.toFixed(1)} ★`
                  : "—"
              }
              hint={`${stats.summary.ratingCount} rated`}
            />
          </div>

          <StatsCharts daily={stats.daily} panels={stats.panels} />

          <Card>
            <CardContent className="py-4">
              <h2 className="mb-3 text-sm font-medium">Staff activity</h2>
              {stats.staff.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tickets were claimed or closed in this range.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Staff</th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Closed
                        </th>
                        <th className="py-2 pr-4 text-right font-medium">
                          Claimed
                        </th>
                        <th className="py-2 text-right font-medium">
                          Avg resolution
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.staff.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <span className="block truncate">{s.name}</span>
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {s.closed}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {s.claimed}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatDuration(s.avgResolutionSeconds)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
