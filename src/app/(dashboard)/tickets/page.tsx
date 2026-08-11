import { Ticket as TicketIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { listTickets } from "@/lib/queries/tickets";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../page-shell";

export default async function TicketsPage() {
  await requireSession();
  const tickets = await listTickets();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="Tickets"
        description="Support tickets opened across your servers."
      />

      {tickets.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="size-8" />}
          title="No tickets yet"
          description="Once members open tickets, they'll appear here. The ticket-opening flow is coming in a future update."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Opener</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Opened</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono">{t.number}</td>
                  <td className="px-4 py-2 font-mono text-xs">{t.openerId}</td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        t.status === "open"
                          ? "text-primary"
                          : "text-muted-foreground"
                      }
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {t.openedAt.toLocaleString()}
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
