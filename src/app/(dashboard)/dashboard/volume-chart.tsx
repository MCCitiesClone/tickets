"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyPoint } from "@/lib/queries/stats";

const volumeConfig = {
  opened: { label: "Opened", color: "var(--chart-1)" },
  closed: { label: "Closed", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Opened-vs-closed tickets per day. Shared by the overview and stats pages. */
export function VolumeChart({
  daily,
  className = "h-64 w-full",
}: {
  daily: DailyPoint[];
  className?: string;
}) {
  return (
    <ChartContainer config={volumeConfig} className={className}>
      <AreaChart data={daily} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v: string) => v.slice(5)}
        />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          dataKey="opened"
          type="monotone"
          stroke="var(--color-opened)"
          fill="var(--color-opened)"
          fillOpacity={0.2}
        />
        <Area
          dataKey="closed"
          type="monotone"
          stroke="var(--color-closed)"
          fill="var(--color-closed)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
