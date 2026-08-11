"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { SimpleSelect } from "@/components/simple-select";
import { setActiveGuild } from "@/app/actions/active-guild";
import type { ManageableGuild } from "@/lib/guild-access";

/** Global server switcher shown in the sidebar. Persists via a cookie. */
export function GuildSelector({
  guilds,
  activeGuildId,
}: {
  guilds: ManageableGuild[];
  activeGuildId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (guilds.length === 0) return null;

  return (
    <SimpleSelect
      value={activeGuildId ?? ""}
      disabled={pending}
      placeholder="Select a server"
      options={guilds.map((g) => ({ value: g.id, label: g.name }))}
      onValueChange={(v) => {
        if (!v || v === activeGuildId) return;
        startTransition(async () => {
          try {
            await setActiveGuild(v);
            router.refresh();
          } catch {
            toast.error("Couldn't switch server.");
          }
        });
      }}
    />
  );
}
