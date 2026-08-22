"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDuration } from "@/lib/duration";
import type { GuildStats } from "@/lib/queries/stats";

/** Quote a CSV field when it contains a comma, quote, or newline. */
function csvCell(value: string | number | null): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV export menu for the detailed stats. Builds files client-side. */
export function StatsExport({
  stats,
  range,
}: {
  stats: GuildStats;
  range: string;
}) {
  const suffix = `-${range}`;

  function exportDaily() {
    download(
      `ticket-volume${suffix}.csv`,
      toCsv([
        ["date", "opened", "closed"],
        ...stats.daily.map((d) => [d.date, d.opened, d.closed]),
      ]),
    );
  }

  function exportStaff() {
    download(
      `staff-activity${suffix}.csv`,
      toCsv([
        ["staff", "user_id", "closed", "claimed", "avg_resolution"],
        ...stats.staff.map((s) => [
          s.name,
          s.id,
          s.closed,
          s.claimed,
          formatDuration(s.avgResolutionSeconds),
        ]),
      ]),
    );
  }

  function exportPanels() {
    download(
      `tickets-by-panel${suffix}.csv`,
      toCsv([
        ["panel", "tickets"],
        ...stats.panels.map((p) => [p.name, p.count]),
      ]),
    );
  }

  function exportPriorities() {
    download(
      `tickets-by-priority${suffix}.csv`,
      toCsv([
        ["priority", "open_now", "opened_in_range"],
        ...stats.priorities.map((p) => [p.priority, p.open, p.openedInRange]),
      ]),
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportDaily}>Ticket volume</DropdownMenuItem>
        <DropdownMenuItem onClick={exportStaff}>
          Staff activity
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPanels}>
          Tickets by panel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPriorities}>
          Tickets by priority
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
