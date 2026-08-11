import Link from "next/link";
import { PanelsTopLeft, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getActiveGuild } from "@/lib/active-guild";
import {
  listGuildMultiPanels,
  listGuildPanels,
} from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "../../page-shell";
import { MultiPanelActions } from "./multi-panel-actions";
import { PanelActions } from "./panel-actions";

export default async function PanelsPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const [panels, multiPanels] = active
    ? await Promise.all([
        listGuildPanels(active.id),
        listGuildMultiPanels(active.id),
      ])
    : [[], []];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Panels"
        description={
          active
            ? `Button messages members use to open tickets in ${active.name}.`
            : "Button messages members use to open tickets."
        }
        action={
          active ? (
            <Link
              href="/dashboard/panels/new"
              className={cn(buttonVariants())}
            >
              <Plus /> New panel
            </Link>
          ) : undefined
        }
      />

      {!active ? (
        <EmptyState
          icon={<PanelsTopLeft className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : panels.length === 0 ? (
        <EmptyState
          icon={<PanelsTopLeft className="size-8" />}
          title="No panels yet"
          description="Create a panel so members can open tickets with a button."
        >
          <Link href="/dashboard/panels/new" className={cn(buttonVariants())}>
            <Plus /> New panel
          </Link>
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {panels.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {p.title}
                    {p.disabled && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (disabled)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {p.messageId
                      ? "Posted"
                      : p.channelId
                        ? "Not posted"
                        : "Not posted · multi-panel only"}
                    {p.questions.length > 0 &&
                      ` · ${p.questions.length} question${p.questions.length === 1 ? "" : "s"}`}
                  </p>
                </div>
                <PanelActions panelId={p.id} canResend={Boolean(p.channelId)} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {active && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Multi-panels</h2>
              <p className="text-sm text-muted-foreground">
                Combine several panels into one message with buttons or a
                dropdown.
              </p>
            </div>
            {panels.length > 0 && (
              <Link
                href="/dashboard/panels/multi/new"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <Plus /> New multi-panel
              </Link>
            )}
          </div>

          {panels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Create at least one panel first.
            </p>
          ) : multiPanels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No multi-panels yet.</p>
          ) : (
            multiPanels.map((mp) => (
              <Card key={mp.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{mp.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {mp.messageId ? "Posted" : "Not posted"} ·{" "}
                      {mp.panelIds.length} panel
                      {mp.panelIds.length === 1 ? "" : "s"} ·{" "}
                      {mp.useDropdown ? "dropdown" : "buttons"}
                    </p>
                  </div>
                  <MultiPanelActions multiPanelId={mp.id} />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
