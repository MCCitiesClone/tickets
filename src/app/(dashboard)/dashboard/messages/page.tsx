import { MessageSquare } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { getGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { MessagesForm } from "./messages-form";

export default async function MessagesPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const config = active ? await getGuild(active.id) : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Messages"
        description={
          active
            ? `Design the system messages for ${active.name} with a rich embed editor.`
            : "Design the bot's system messages with a rich embed editor."
        }
      />

      {!active ? (
        <EmptyState
          icon={<MessageSquare className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <MessagesForm
          guildId={active.id}
          initial={config?.messageTemplates ?? {}}
        />
      )}
    </div>
  );
}
