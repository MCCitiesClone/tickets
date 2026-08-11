import { PanelsTopLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getActiveGuild } from "@/lib/active-guild";
import { listGuildPanels } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { CreatePanelForm } from "./create-panel-form";
import { DeletePanelButton } from "./delete-panel-button";

export default async function PanelsPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const panels = active ? await listGuildPanels(active.id) : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Panels"
        description={
          active
            ? `Button messages members use to open tickets in ${active.name}.`
            : "Button messages members use to open tickets."
        }
      />

      {!active ? (
        <EmptyState
          icon={<PanelsTopLeft className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <CreatePanelForm guildId={active.id} />
      )}

      {panels.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            Existing panels
          </h2>
          {panels.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.messageId ? "Posted" : "Not posted"}
                  </p>
                </div>
                <DeletePanelButton panelId={p.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
