import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyPoint, PanelStat } from "@/lib/queries/stats";
import { PanelChart } from "./panel-chart";
import { VolumeChart } from "./volume-chart";

/** The two side-by-side charts on the detailed stats page. */
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
          <VolumeChart daily={daily} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets by panel</CardTitle>
        </CardHeader>
        <CardContent>
          <PanelChart panels={panels} />
        </CardContent>
      </Card>
    </div>
  );
}
