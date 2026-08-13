import { Ban } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { fetchDiscordUser, fetchGuildRoles } from "@/lib/discord-api";
import { listGuildBlacklist } from "@/lib/queries/blacklist";
import {
  listGuildTicketOpeners,
  type TicketOpener,
} from "@/lib/queries/tickets";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { BlacklistManager } from "./blacklist-manager";

export default async function BlacklistPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const [entries, roles, openers] = active
    ? await Promise.all([
        listGuildBlacklist(active.id),
        fetchGuildRoles(active.id),
        listGuildTicketOpeners(active.id),
      ])
    : [[], [], []];

  // Resolve blacklisted user IDs that aren't ticket openers (e.g. added by ID)
  // so the list shows names/avatars instead of raw IDs.
  const known = new Set(openers.map((u) => u.id));
  const missingIds = [
    ...new Set(
      entries
        .filter((e) => e.targetType === "user" && !known.has(e.targetId))
        .map((e) => e.targetId),
    ),
  ];
  const resolved = await Promise.all(missingIds.map((id) => fetchDiscordUser(id)));
  const users: TicketOpener[] = [
    ...openers,
    ...resolved.flatMap((u) => (u ? [u] : [])),
  ];

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
        <BlacklistManager
          guildId={active.id}
          initial={entries}
          roles={roles}
          users={users}
        />
      )}
    </div>
  );
}
