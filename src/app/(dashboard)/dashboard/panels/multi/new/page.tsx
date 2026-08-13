import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { listGuildPanels } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { EmptyState } from "../../../../page-shell";
import { MultiPanelForm } from "../multi-panel-form";

export default async function NewMultiPanelPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const panels = active ? await listGuildPanels(active.id) : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/panels"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Panels
        </Link>
        <h1 className="text-2xl font-semibold">New multi-panel</h1>
      </div>

      {active ? (
        <MultiPanelForm
          guildId={active.id}
          availablePanels={panels.map((p) => ({
            id: p.id,
            name: p.buttonLabel || p.title,
            emoji: p.buttonEmoji,
            color: p.buttonColor,
          }))}
        />
      ) : (
        <EmptyState
          title="No server selected"
          description="Pick a server from the switcher in the sidebar first."
        />
      )}
    </div>
  );
}
