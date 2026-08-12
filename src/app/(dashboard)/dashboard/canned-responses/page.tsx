import { MessageSquareText } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { listGuildCannedResponses } from "@/lib/queries/canned-responses";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { CannedResponsesManager } from "./canned-responses-manager";

export default async function CannedResponsesPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const responses = active ? await listGuildCannedResponses(active.id) : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Canned responses"
        description={
          active
            ? `Saved, reusable staff replies for ${active.name}, posted with /cannedresponse.`
            : "Saved, reusable staff replies posted with /cannedresponse."
        }
      />

      {!active ? (
        <EmptyState
          icon={<MessageSquareText className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <CannedResponsesManager guildId={active.id} initial={responses} />
      )}
    </div>
  );
}
