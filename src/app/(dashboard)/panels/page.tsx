import { PanelsTopLeft } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listPanels } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../page-shell";

export default async function PanelsPage() {
  await requireSession();
  const panels = await listPanels();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Panels"
        description="Button messages members use to open tickets."
      />

      {panels.length === 0 ? (
        <EmptyState
          icon={<PanelsTopLeft className="size-8" />}
          title="No panels yet"
          description="Panels let members open a ticket with a button. Creating and posting panels from the dashboard is coming soon; the /panel command is stubbed in the bot."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {panels.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
