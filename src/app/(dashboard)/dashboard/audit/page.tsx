import { ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  collectMentionIds,
  DiscordMentions,
  type MentionNames,
} from "@/components/discord-mentions";
import { getActiveGuild } from "@/lib/active-guild";
import {
  AUDIT_SOURCE_LABEL,
  auditActionMeta,
  type AuditGroup,
  AUDIT_GROUPS,
  actionsInGroup,
} from "@/lib/audit";
import {
  fetchDiscordUser,
  fetchGuildChannels,
  fetchGuildRoles,
} from "@/lib/discord-api";
import { listAuditActors, listAuditLog } from "@/lib/queries/audit";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { AuditFilters } from "./audit-filters";
import { AuditPager } from "./audit-pager";

const PAGE_SIZE = 50;
const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
const DAY_MS = 24 * 60 * 60 * 1000;

type Search = {
  group?: string;
  actor?: string;
  range?: string;
  page?: string;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireSession();
  const { active } = await getActiveGuild();
  const params = await searchParams;

  if (!active) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader title="Audit log" description="Every change, in one place." />
        <EmptyState
          icon={<ScrollText className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar."
        />
      </div>
    );
  }

  const group = AUDIT_GROUPS.includes(params.group as AuditGroup)
    ? (params.group as AuditGroup)
    : undefined;
  const range = params.range && params.range in RANGES ? params.range : undefined;
  const page = Math.max(1, Number(params.page) || 1);

  // `new Date()` rather than `Date.now()`: the React Compiler treats the latter
  // as an impure call during render (same shape as the Stats page).
  const now = new Date();
  const { entries, total } = await listAuditLog(
    active.id,
    {
      actions: group ? actionsInGroup(group) : undefined,
      actorId: params.actor || undefined,
      from: range
        ? new Date(now.getTime() - RANGES[range] * DAY_MS)
        : undefined,
    },
    { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
  );

  // Resolve the IDs the summaries mention so the trail reads in names.
  const mentioned = collectMentionIds(entries.map((e) => e.summary));
  const [actors, channels, roles, users] = await Promise.all([
    listAuditActors(active.id),
    mentioned.channels.length
      ? fetchGuildChannels(active.id)
      : Promise.resolve(null),
    mentioned.roles.length ? fetchGuildRoles(active.id) : Promise.resolve([]),
    Promise.all(mentioned.users.map((id) => fetchDiscordUser(id))),
  ]);

  const names: MentionNames = {
    users: Object.fromEntries(
      users.flatMap((u) => (u ? [[u.id, u.name]] : [])),
    ),
    roles: Object.fromEntries(roles.map((r) => [r.id, r.name])),
    channels: Object.fromEntries(
      [...(channels?.text ?? []), ...(channels?.categories ?? [])].map((c) => [
        c.id,
        c.name,
      ]),
    ),
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Audit log"
        description={`Every ticket and configuration change in ${active.name}.`}
      />

      <AuditFilters actors={actors} />

      {entries.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-8" />}
          title={total === 0 ? "Nothing recorded yet" : "No matching entries"}
          description={
            total === 0
              ? "Ticket activity and configuration changes will appear here as they happen."
              : "Try widening the filters above."
          }
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y">
              {entries.map((entry) => {
                const meta = auditActionMeta(entry.action);
                return (
                  <li key={entry.id} className="flex gap-3 px-4 py-3">
                    <span
                      aria-hidden
                      className="mt-0.5 shrink-0 text-base leading-none"
                    >
                      {meta.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <DiscordMentions
                        text={entry.summary}
                        names={names}
                        className="text-sm"
                      />
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <Badge variant="outline">{meta.label}</Badge>
                        <span>{AUDIT_SOURCE_LABEL[entry.source]}</span>
                        {entry.actorName && <span>· {entry.actorName}</span>}
                        <span>· {entry.createdAt.toLocaleString()}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          <AuditPager page={page} pages={pages} total={total} />
        </>
      )}
    </div>
  );
}
