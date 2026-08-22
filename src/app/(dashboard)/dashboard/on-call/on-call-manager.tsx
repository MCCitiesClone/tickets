"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityCombobox, type ComboEntity } from "@/components/entity-combobox";
import {
  addOnCall,
  removeOnCall,
  setOnCallActive,
} from "@/app/actions/on-call";
import type { OnCall } from "@/db/schema";
import type { TicketOpener } from "@/lib/queries/tickets";
import { EmptyState } from "../../page-shell";

export function OnCallManager({
  guildId,
  initial,
  users,
  pingEnabled,
}: {
  guildId: string;
  initial: OnCall[];
  users: TicketOpener[];
  pingEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [userId, setUserId] = useState<string | null>(null);
  /** Per-row note drafts, keyed by user ID. */
  const [notes, setNotes] = useState<Record<string, string>>({});

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const userAvatar = (id: string) =>
    users.find((u) => u.id === id)?.avatarUrl ?? null;

  const activeCount = initial.filter((r) => r.active).length;

  // Resolve a pasted user ID to a name + avatar via the bot (guarded route).
  async function resolveUser(id: string): Promise<ComboEntity | null> {
    try {
      const res = await fetch(`/api/guilds/${guildId}/users/${id}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { user: ComboEntity | null };
      return data.user;
    } catch {
      return null;
    }
  }

  function run(action: () => Promise<unknown>, success: string, failure: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : failure);
      }
    });
  }

  function add() {
    const id = userId?.trim();
    if (!id) {
      toast.error("Pick or paste a staff member.");
      return;
    }
    run(
      async () => {
        await addOnCall({ guildId, userId: id });
        setUserId(null);
      },
      "Added to the roster.",
      "Couldn't add that member.",
    );
  }

  function toggle(entry: OnCall) {
    run(
      () =>
        setOnCallActive({
          guildId,
          userId: entry.userId,
          active: !entry.active,
          note: entry.active ? null : (notes[entry.userId] ?? null),
        }),
      entry.active ? "Taken off call." : "Put on call.",
      "Couldn't update that member.",
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!pingEnabled && (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          On-call notifications are turned off for this server, so nobody is DMed
          when a ticket opens. Turn them back on under{" "}
          <strong>Settings → Notify on-call staff when a ticket opens</strong>.
        </p>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-1.5">
            <Label>Add a staff member to the roster</Label>
            <EntityCombobox
              entities={users}
              value={userId}
              onValueChange={setUserId}
              allowPasteId
              resolveId={resolveUser}
              placeholder="Search staff or paste a user ID…"
              emptyText="No matching staff. Paste a Discord user ID to add someone who isn't listed."
            />
            <p className="text-xs text-muted-foreground">
              Lists members who&apos;ve replied in a ticket here. Not listed?
              Enable Developer Mode in Discord, right-click a user → Copy User
              ID, and paste it.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={add} disabled={pending}>
              <Plus className="size-4" />
              Add to roster
            </Button>
          </div>
        </CardContent>
      </Card>

      {initial.length === 0 ? (
        <EmptyState
          icon={<BellRing className="size-8" />}
          title="Nobody is on the roster"
          description="Add staff here, or let them take the pager themselves with /oncall claim."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {activeCount === 0 && (
            <p className="rounded-md bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-400">
              Nobody is on call right now — new tickets won&apos;t notify anyone.
            </p>
          )}

          {initial.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  {userAvatar(entry.userId) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userAvatar(entry.userId)!}
                      alt=""
                      className="size-8 shrink-0 rounded-full"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {userName(entry.userId)}
                      {entry.active && (
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-600 dark:text-green-400"
                        >
                          On call
                        </Badge>
                      )}
                    </p>
                    {userName(entry.userId) !== entry.userId && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {entry.userId}
                      </p>
                    )}
                    {entry.active && entry.note && (
                      <p className="truncate text-sm text-muted-foreground">
                        {entry.note}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {entry.updatedBy ? `Updated by ${entry.updatedBy} · ` : ""}
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!entry.active && (
                    <Input
                      placeholder="Note, e.g. until 17:00 UTC"
                      className="w-52"
                      maxLength={100}
                      value={notes[entry.userId] ?? ""}
                      onChange={(e) =>
                        setNotes((n) => ({
                          ...n,
                          [entry.userId]: e.target.value,
                        }))
                      }
                    />
                  )}
                  <Button
                    type="button"
                    variant={entry.active ? "outline" : "default"}
                    size="sm"
                    onClick={() => toggle(entry)}
                    disabled={pending}
                  >
                    {entry.active ? (
                      <>
                        <BellOff className="size-4" />
                        Take off call
                      </>
                    ) : (
                      <>
                        <BellRing className="size-4" />
                        Put on call
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      run(
                        () => removeOnCall(guildId, entry.userId),
                        "Removed from the roster.",
                        "Couldn't remove that member.",
                      )
                    }
                    disabled={pending}
                    aria-label="Remove from roster"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
