import { Ban } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { listGuildBlacklist } from "@/lib/queries/blacklist";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { BlacklistManager } from "./blacklist-manager";

export default async function BlacklistPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const entries = active ? await listGuildBlacklist(active.id) : [];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Blacklist"
        description={
          active
            ? `Users and roles blocked from opening tickets in ${active.name}.`
            : "Users and roles blocked from opening tickets."
        }
      />

      {!active ? (
        <EmptyState
          icon={<Ban className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <BlacklistManager guildId={active.id} initial={entries} />
      )}
    </div>
  );
}
