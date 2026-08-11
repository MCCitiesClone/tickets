"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  // value -> label map; base-ui Select uses it to show the name in the trigger.
  const items = Object.fromEntries(guilds.map((g) => [g.id, g.name]));

  return (
    <Select
      items={items}
      value={activeGuildId ?? ""}
      disabled={pending}
      onValueChange={(v) => {
        const id = v as string;
        if (!id || id === activeGuildId) return;
        startTransition(async () => {
          try {
            await setActiveGuild(id);
            router.refresh();
          } catch {
            toast.error("Couldn't switch server.");
          }
        });
      }}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a server" />
      </SelectTrigger>
      <SelectContent>
        {guilds.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
