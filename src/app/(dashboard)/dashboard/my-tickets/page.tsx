import Link from "next/link";
import { FileText, TicketCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fetchBotGuilds } from "@/lib/discord-api";
import { listTicketsForMember } from "@/lib/queries/tickets";
import { getSessionActor, requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";

/**
 * A member's own tickets, across every server.
 *
 * Unlike the rest of the dashboard this needs no Manage Server rights — it's the
 * one page a regular member has a reason to visit. The listing is scoped by the
 * signed-in user's Discord ID in the query itself, so it can't surface anyone
 * else's tickets regardless of what's in the URL.
 */
export default async function MyTicketsPage() {
  await requireSession();
  const actor = await getSessionActor();

  if (!actor.id) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <PageHeader title="My tickets" description="Tickets you've been part of." />
        <EmptyState
          icon={<TicketCheck className="size-8" />}
          title="Discord account not linked"
          description="Sign out and back in with Discord so we can match your tickets to your account."
        />
      </div>
    );
  }

  const [tickets, { guilds }] = await Promise.all([
    listTicketsForMember(actor.id),
    fetchBotGuilds(),
  ]);
  const guildName = new Map(guilds.map((g) => [g.id, g.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="My tickets"
        description="Tickets you opened or took part in, across every server."
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={<TicketCheck className="size-8" />}
          title="No tickets yet"
          description="Tickets you open — or reply in — will appear here, with a link to the transcript once they close."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Server</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Opened</th>
                <th className="px-4 py-2 font-medium">Transcript</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono">{t.number}</td>
                  <td className="px-4 py-2">
                    {/* The bot may have left a server since the ticket closed. */}
                    {guildName.get(t.guildId) ?? (
                      <span className="text-muted-foreground">Unknown server</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.panelTitle ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          t.status === "open"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }
                      >
                        {t.status}
                      </span>
                      {!t.opened && (
                        <Badge variant="outline" title="You replied in this ticket">
                          Took part
                        </Badge>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.openedAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    {t.transcriptToken ? (
                      <Link
                        href={`/transcripts/${t.transcriptToken}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="size-3.5" /> View
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
