import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord-api";
import { canManageGuild, getManageableGuilds } from "@/lib/guild-access";
import { getGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { GuildSettingsForm } from "./settings-form";

export default async function GuildSettingsPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  await requireSession();
  const { guildId } = await params;

  // Authorization: only servers the user manages and the bot is in.
  if (!(await canManageGuild(guildId))) notFound();

  const [config, channels, roles, { guilds }] = await Promise.all([
    getGuild(guildId),
    fetchGuildChannels(guildId),
    fetchGuildRoles(guildId),
    getManageableGuilds(),
  ]);

  const guildName = guilds.find((g) => g.id === guildId)?.name ?? guildId;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard/settings"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> All servers
        </Link>
        <h1 className="text-2xl font-semibold">{guildName}</h1>
        <p className="text-muted-foreground">Ticket configuration</p>
      </div>

      <GuildSettingsForm
        guildId={guildId}
        config={config}
        categories={channels.categories}
        textChannels={channels.text}
        roles={roles}
      />
    </div>
  );
}
