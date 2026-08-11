import { PanelsTopLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getManageableGuilds } from "@/lib/guild-access";
import { listPanels } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../page-shell";
import { CreatePanelForm } from "./create-panel-form";
import { DeletePanelButton } from "./delete-panel-button";

export default async function PanelsPage() {
  await requireSession();
  const [{ guilds }, panels] = await Promise.all([
    getManageableGuilds(),
    listPanels(),
  ]);

  const guildName = (id: string) =>
    guilds.find((g) => g.id === id)?.name ?? id;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Panels"
        description="Button messages members use to open tickets."
      />

      {guilds.length === 0 ? (
        <EmptyState
          icon={<PanelsTopLeft className="size-8" />}
          title="No servers available"
          description="Invite the bot to a server you manage, then you can post panels here."
        />
      ) : (
        <CreatePanelForm guilds={guilds} />
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
                    {guildName(p.guildId)}
                    {p.messageId ? " · posted" : " · not posted"}
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
