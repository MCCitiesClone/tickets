import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { canManageGuild } from "@/lib/guild-access";
import { getPanel } from "@/lib/queries/panels";
import { requireSession } from "@/lib/session";
import { PanelForm } from "../panel-form";

export default async function EditPanelPage({
  params,
}: {
  params: Promise<{ panelId: string }>;
}) {
  await requireSession();
  const { panelId } = await params;

  const panel = await getPanel(panelId);
  if (!panel || !(await canManageGuild(panel.guildId))) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/panels"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Panels
        </Link>
        <h1 className="text-2xl font-semibold">Edit panel</h1>
      </div>

      <PanelForm guildId={panel.guildId} panel={panel} />
    </div>
  );
}
