"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyPoint, PanelStat } from "@/lib/queries/stats";

const volumeConfig = {
  opened: { label: "Opened", color: "var(--chart-1)" },
  closed: { label: "Closed", color: "var(--chart-3)" },
} satisfies ChartConfig;

const panelConfig = {
  count: { label: "Tickets", color: "var(--chart-1)" },
} satisfies ChartConfig;

const truncate = (v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v);

export function StatsCharts({
  daily,
  panels,
}: {
  daily: DailyPoint[];
  panels: PanelStat[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Ticket volume</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={volumeConfig} className="h-64 w-full">
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
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
              />
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets by panel</CardTitle>
        </CardHeader>
        <CardContent>
          {panels.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No tickets in this range.
            </p>
          ) : (
            <ChartContainer config={panelConfig} className="h-64 w-full">
              <BarChart
                data={panels}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={112}
                  tickFormatter={truncate}
                />
                <ChartTooltip
                  content={<ChartTooltipContent hideLabel />}
                  cursor={false}
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
