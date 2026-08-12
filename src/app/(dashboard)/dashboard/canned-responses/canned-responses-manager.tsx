"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageTemplateEditor } from "@/components/message-editor/message-template-editor";
import { RoleMultiSelect, type Role } from "@/components/role-multi-select";
import {
  createCannedResponse,
  deleteCannedResponse,
  updateCannedResponse,
} from "@/app/actions/canned-response";
import type { CannedResponse, MessageTemplate } from "@/db/schema";
import { EmptyState } from "../../page-shell";

/** Placeholder tokens the bot fills for a canned response. */
const PLACEHOLDERS = ["server", "channel", "ticket", "number", "opener"];

const EMPTY_TEMPLATE: MessageTemplate = { embeds: [] };

export function CannedResponsesManager({
  guildId,
  initial,
}: {
  guildId: string;
  initial: CannedResponse[];
}) {
  const [editing, setEditing] = useState<CannedResponse | "new" | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteCannedResponse(guildId, id);
        toast.success("Canned response deleted.");
        router.refresh();
      } catch {
        toast.error("Couldn't delete that response.");
      }
    });
  }

  if (editing) {
    return (
      <Editor
        guildId={guildId}
        roles={roles}
        response={editing === "new" ? null : editing}
        onDone={() => {
          setEditing(null);
          router.refresh();
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setEditing("new")}>
          <Plus /> New response
        </Button>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="size-8" />}
          title="No canned responses yet"
          description="Create reusable replies your staff can post in a ticket with /cannedresponse."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {initial.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="font-mono text-sm">{r.name}</CardTitle>
                  {r.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing(r)}
                    aria-label="Edit response"
                    title="Edit"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    onClick={() => remove(r.id)}
                    aria-label="Delete response"
                    title="Delete"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {r.accessRoleIds.length > 0
                  ? `Restricted to ${r.accessRoleIds.length} role(s)`
                  : "Any staff member can use this"}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({
  guildId,
  roles,
  response,
  onDone,
  onCancel,
}: {
  guildId: string;
  roles: Role[];
  response: CannedResponse | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(response?.name ?? "");
  const [description, setDescription] = useState(response?.description ?? "");
  const [accessRoleIds, setAccessRoleIds] = useState<string[]>(
    response?.accessRoleIds ?? [],
  );
  const [template, setTemplate] = useState<MessageTemplate>(
    response?.template ?? EMPTY_TEMPLATE,
  );
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        if (response) {
          await updateCannedResponse({
            guildId,
            id: response.id,
            name,
            description: description || null,
            accessRoleIds,
            template,
          });
        } else {
          await createCannedResponse({
            guildId,
            name,
            description: description || null,
            accessRoleIds,
            template,
          });
        }
        toast.success("Canned response saved.");
        onDone();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't save. Try again.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cr-name">Name</Label>
        <Input
          id="cr-name"
          value={name}
          maxLength={80}
          placeholder="refund-faq"
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The key staff pick from <code>/cannedresponse</code> autocomplete.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cr-desc">Description (optional)</Label>
        <Input
          id="cr-desc"
          value={description}
          maxLength={200}
          placeholder="Explains our refund policy"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Restrict to roles (optional)</Label>
        <RoleMultiSelect
          roles={roles}
          value={accessRoleIds}
          onChange={setAccessRoleIds}
          emptyText="No roles loaded. Leave empty to allow any staff member."
        />
        <p className="text-xs text-muted-foreground">
          Leave empty to let any staff member use this response.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Message</Label>
        <MessageTemplateEditor
          value={template}
          onChange={setTemplate}
          placeholders={PLACEHOLDERS}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={pending || !name.trim()}>
          {pending ? "Saving…" : "Save response"}
        </Button>
      </div>
    </div>
  );
}
