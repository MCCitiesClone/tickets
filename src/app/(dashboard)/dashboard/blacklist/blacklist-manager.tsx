"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EntityCombobox, type ComboEntity } from "@/components/entity-combobox";
import type { Role } from "@/components/role-multi-select";
import { addBlacklist, removeBlacklist } from "@/app/actions/blacklist";
import type { Blacklist } from "@/db/schema";
import type { TicketOpener } from "@/lib/queries/tickets";
import { EmptyState } from "../../page-shell";

export function BlacklistManager({
  guildId,
  initial,
  roles,
  users,
}: {
  guildId: string;
  initial: Blacklist[];
  roles: Role[];
  users: TicketOpener[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<"user" | "role">("user");
  const [userId, setUserId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id;

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

  function add() {
    const targetId = type === "user" ? userId?.trim() : roleId?.trim();
    if (!targetId) {
      toast.error(type === "user" ? "Pick or paste a user." : "Pick a role.");
      return;
    }
    startTransition(async () => {
      try {
        await addBlacklist({
          guildId,
          targetType: type,
          targetId,
          reason: reason.trim() || null,
        });
        toast.success("Added to the blacklist.");
        setUserId(null);
        setRoleId(null);
        setReason("");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't add that entry.",
        );
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await removeBlacklist(guildId, id);
        toast.success("Removed from the blacklist.");
        router.refresh();
      } catch {
        toast.error("Couldn't remove that entry.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label>Block a user or role</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={type === "user" ? "default" : "outline"}
                onClick={() => setType("user")}
              >
                User
              </Button>
              <Button
                type="button"
                size="sm"
                variant={type === "role" ? "default" : "outline"}
                onClick={() => setType("role")}
              >
                Role
              </Button>
            </div>
          </div>

          {type === "user" ? (
            <div className="flex flex-col gap-1.5">
              <Label>User</Label>
              <EntityCombobox
                entities={users}
                value={userId}
                onValueChange={setUserId}
                allowPasteId
                resolveId={resolveUser}
                placeholder="Search users or paste a user ID…"
                emptyText="No matching users. Paste a Discord user ID to block someone who isn't listed."
              />
              <p className="text-xs text-muted-foreground">
                Lists members who&apos;ve opened tickets here. Not listed? Enable
                Developer Mode in Discord, right-click a user → Copy User ID, and
                paste it.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Role</Label>
              <EntityCombobox
                entities={roles}
                value={roleId}
                onValueChange={setRoleId}
                placeholder={
                  roles.length ? "Search roles…" : "No roles available"
                }
                emptyText="No matching roles."
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bl-reason">Reason (optional)</Label>
            <Input
              id="bl-reason"
              placeholder="Shown to staff, never to the blocked member"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={add} disabled={pending}>
              <Plus className="size-4" />
              Add to blacklist
            </Button>
          </div>
        </CardContent>
      </Card>

      {initial.length === 0 ? (
        <EmptyState
          icon={<Ban className="size-8" />}
          title="No one is blacklisted"
          description="Blocked users and roles will appear here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {initial.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {entry.targetType === "role"
                      ? `Role: ${roleName(entry.targetId)}`
                      : `User: ${userName(entry.targetId)}`}
                  </p>
                  {entry.targetType === "user" &&
                    userName(entry.targetId) !== entry.targetId && (
                      <p className="font-mono text-xs text-muted-foreground">
                        {entry.targetId}
                      </p>
                    )}
                  {entry.reason && (
                    <p className="truncate text-sm text-muted-foreground">
                      {entry.reason}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {entry.addedBy ? `Added by ${entry.addedBy} · ` : ""}
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(entry.id)}
                  disabled={pending}
                  aria-label="Remove from blacklist"
                >
                  <Trash2 className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
