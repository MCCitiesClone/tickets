import { BellRing } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { fetchDiscordUser } from "@/lib/discord-api";
import { getGuild } from "@/lib/queries/guild";
import { listOnCall } from "@/lib/queries/on-call";
import {
  listGuildTicketStaff,
  type TicketOpener,
} from "@/lib/queries/tickets";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { OnCallManager } from "./on-call-manager";

export default async function OnCallPage() {
  await requireSession();
  const { active } = await getActiveGuild();
  const [roster, staff, config] = active
    ? await Promise.all([
        listOnCall(active.id),
        listGuildTicketStaff(active.id),
        getGuild(active.id),
      ])
    : [[], [], null];

  // Roster members who've never replied in a ticket (added by ID, or brand new)
  // aren't in `staff` — resolve them so the list shows names, not raw IDs.
  const known = new Set(staff.map((u) => u.id));
  const missingIds = roster.filter((r) => !known.has(r.userId)).map((r) => r.userId);
  const resolved = await Promise.all(missingIds.map((id) => fetchDiscordUser(id)));
  const users: TicketOpener[] = [
    ...staff,
    ...resolved.flatMap((u) => (u ? [u] : [])),
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="On call"
        description={
          active
            ? `Staff who get DMed the moment a ticket opens in ${active.name}.`
            : "Staff who get DMed the moment a ticket opens."
        }
      />

      {!active ? (
        <EmptyState
          icon={<BellRing className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      ) : (
        <OnCallManager
          guildId={active.id}
          initial={roster}
          users={users}
          pingEnabled={config?.onCallPingOnOpen ?? true}
        />
      )}
    </div>
  );
}
