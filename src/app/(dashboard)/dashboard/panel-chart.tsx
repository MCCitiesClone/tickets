"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PanelStat } from "@/lib/queries/stats";

const panelConfig = {
  count: { label: "Tickets", color: "var(--chart-1)" },
} satisfies ChartConfig;

const truncate = (v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v);

/** Tickets opened per panel. */
export function PanelChart({ panels }: { panels: PanelStat[] }) {
  if (panels.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No tickets in this range.
      </p>
    );
  }
  return (
    <ChartContainer config={panelConfig} className="h-64 w-full">
      <BarChart data={panels} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={112}
          tickFormatter={truncate}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
