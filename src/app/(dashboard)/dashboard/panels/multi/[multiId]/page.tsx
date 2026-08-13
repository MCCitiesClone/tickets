import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { canManageGuild } from "@/lib/guild-access";
import { getMultiPanel, listGuildPanels } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { MultiPanelForm } from "../multi-panel-form";

export default async function EditMultiPanelPage({
  params,
}: {
  params: Promise<{ multiId: string }>;
}) {
  await requireSession();
  const { multiId } = await params;

  const multiPanel = await getMultiPanel(multiId);
  if (!multiPanel || !(await canManageGuild(multiPanel.guildId))) notFound();

  const panels = await listGuildPanels(multiPanel.guildId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/panels"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Panels
        </Link>
        <h1 className="text-2xl font-semibold">Edit multi-panel</h1>
      </div>

      <MultiPanelForm
        guildId={multiPanel.guildId}
        multiPanel={multiPanel}
        availablePanels={panels.map((p) => ({
          id: p.id,
          name: p.buttonLabel || p.title,
          emoji: p.buttonEmoji,
          color: p.buttonColor,
        }))}
      />
    </div>
  );
}
