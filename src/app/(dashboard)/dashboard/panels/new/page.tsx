import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { requireSession } from "@/lib/session";
import { EmptyState } from "../../../page-shell";
import { PanelForm } from "../panel-form";

export default async function NewPanelPage() {
  await requireSession();
  const { active } = await getActiveGuild();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/panels"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Panels
        </Link>
        <h1 className="text-2xl font-semibold">New panel</h1>
      </div>

      {active ? (
        <PanelForm guildId={active.id} />
      ) : (
        <EmptyState
          title="No server selected"
          description="Pick a server from the switcher in the sidebar first."
        />
      )}
    </div>
  );
}
