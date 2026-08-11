import { Settings as SettingsIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listGuilds } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../page-shell";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  await requireSession();
  const guilds = await listGuilds();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Per-server ticket configuration."
      />

      {guilds.length === 0 ? (
        <EmptyState
          icon={<SettingsIcon className="size-8" />}
          title="No servers configured"
          description="Run /setup in a server to create its configuration, then it'll show up here. Editable settings forms are coming to this page next."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {guilds.map((g) => (
            <Card key={g.guildId}>
              <CardHeader>
                <CardTitle className="font-mono text-base">
                  Guild {g.guildId}
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                <Field
                  label="Ticket category"
                  value={g.ticketCategoryId ?? "— not set —"}
                />
                <Field
                  label="Transcript channel"
                  value={g.transcriptChannelId ?? "— not set —"}
                />
                <Field
                  label="Log channel"
                  value={g.logChannelId ?? "— not set —"}
                />
                <Field
                  label="Staff roles"
                  value={
                    g.staffRoleIds.length
                      ? g.staffRoleIds.join(", ")
                      : "— none —"
                  }
                />
                <Field label="Ticket limit" value={String(g.ticketLimit)} />
                <Field label="Naming scheme" value={g.namingScheme} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
