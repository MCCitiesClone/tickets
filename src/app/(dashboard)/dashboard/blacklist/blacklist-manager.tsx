"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/components/role-multi-select";
import { addBlacklist, removeBlacklist } from "@/app/actions/blacklist";
import type { Blacklist } from "@/db/schema";
import { EmptyState } from "../../page-shell";

export function BlacklistManager({
  guildId,
  initial,
}: {
  guildId: string;
  initial: Blacklist[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roles, setRoles] = useState<Role[]>([]);

  const [type, setType] = useState<"user" | "role">("user");
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/guilds/${guildId}/roles`)
      .then((r) => r.json())
      .then((data: { roles: Role[] }) => {
        if (!cancelled) setRoles(data.roles ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load roles.");
      });
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  function add() {
    const targetId = type === "user" ? userId.trim() : roleId;
    if (!targetId) {
      toast.error(type === "user" ? "Enter a user ID." : "Pick a role.");
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
        setUserId("");
        setRoleId("");
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
              <Label htmlFor="bl-user">User ID</Label>
              <Input
                id="bl-user"
                inputMode="numeric"
                placeholder="e.g. 123456789012345678"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enable Developer Mode in Discord, then right-click a user → Copy
                User ID.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bl-role">Role</Label>
              <select
                id="bl-role"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">
                  {roles.length ? "— Select a role —" : "Loading roles…"}
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
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
                      : `User: ${entry.targetId}`}
                  </p>
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
