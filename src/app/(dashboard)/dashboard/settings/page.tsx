import { Settings as SettingsIcon } from "lucide-react";

import { getActiveGuild } from "@/lib/active-guild";
import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord-api";
import { getGuild } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { EmptyState, PageHeader } from "../../page-shell";
import { GuildSettingsForm } from "./[guildId]/settings-form";

export default async function SettingsPage() {
  await requireSession();
  const { active } = await getActiveGuild();

  if (!active) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <PageHeader
          title="Settings"
          description="Per-server ticket configuration."
        />
        <EmptyState
          icon={<SettingsIcon className="size-8" />}
          title="No server selected"
          description="Invite the bot to a server you manage, then pick it from the switcher in the sidebar to configure it."
        />
      </div>
    );
  }

  const [config, channels, roles] = await Promise.all([
    getGuild(active.id),
    fetchGuildChannels(active.id),
    fetchGuildRoles(active.id),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Settings"
        description={`Ticket configuration for ${active.name}.`}
      />
      <GuildSettingsForm
        guildId={active.id}
        config={config}
        categories={channels.categories}
        textChannels={channels.text}
        roles={roles}
      />
    </div>
  );
}
