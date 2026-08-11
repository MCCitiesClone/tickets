"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createChannel } from "@/app/actions/channel";

/** Sentinel value for the "no channel" option (shared with parent state). */
export const CHANNEL_NONE = "none";
const CREATE = "__create__";

export type Channel = { id: string; name: string };

/**
 * A Discord channel picker built on the shadcn Select, with a built-in
 * "Create new channel" option that opens a modal. `kind` controls whether it
 * lists/creates text channels or categories.
 */
export function ChannelSelect({
  id,
  guildId,
  kind,
  channels,
  categories = [],
  value,
  onValueChange,
  placeholder,
  allowNone = false,
  noneLabel = "— None —",
  disabled,
}: {
  id?: string;
  guildId: string;
  kind: "text" | "category";
  channels: Channel[];
  /** Categories to offer as a parent when creating a text channel. */
  categories?: Channel[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  disabled?: boolean;
}) {
  const [created, setCreated] = useState<Channel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const prefix = kind === "text" ? "#" : "";

  // Merge base channels with any created this session (dedup by id).
  const all = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of channels) map.set(c.id, c.name);
    for (const c of created) map.set(c.id, c.name);
    return [...map].map(([cid, name]) => ({ id: cid, name }));
  }, [channels, created]);

  // value -> label map so the trigger shows the channel name, not the id.
  const items: Record<string, string> = {
    ...(allowNone ? { [CHANNEL_NONE]: noneLabel } : {}),
    ...Object.fromEntries(all.map((c) => [c.id, `${prefix}${c.name}`])),
    [CREATE]: "Create new channel",
  };

  return (
    <>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          const next = v as string;
          if (next === CREATE) {
            setDialogOpen(true);
            return;
          }
          onValueChange(next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={CHANNEL_NONE}>{noneLabel}</SelectItem>}
          {all.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {prefix}
              {c.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CREATE}>
            <Plus /> Create new channel
          </SelectItem>
        </SelectContent>
      </Select>

      <CreateChannelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        guildId={guildId}
        kind={kind}
        categories={categories}
        onCreated={(ch) => {
          setCreated((prev) => [...prev, ch]);
          onValueChange(ch.id);
          setDialogOpen(false);
        }}
      />
    </>
  );
}

function CreateChannelDialog({
  open,
  onOpenChange,
  guildId,
  kind,
  categories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  kind: "text" | "category";
  categories: Channel[];
  onCreated: (channel: Channel) => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState(CHANNEL_NONE);
  const [pending, startTransition] = useTransition();

  const label = kind === "category" ? "category" : "channel";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a name.");
      return;
    }
    startTransition(async () => {
      try {
        const channel = await createChannel({
          guildId,
          name: trimmed,
          kind,
          parentId:
            kind === "text" && parentId !== CHANNEL_NONE ? parentId : null,
        });
        toast.success(`Created ${label} “${channel.name}”.`);
        setName("");
        setParentId(CHANNEL_NONE);
        onCreated(channel);
      } catch {
        toast.error(
          `Couldn't create the ${label}. Check the bot's permissions.`,
        );
      }
    });
  }

  const parentItems: Record<string, string> = {
    [CHANNEL_NONE]: "— No category —",
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create a {label}</DialogTitle>
            <DialogDescription>
              This creates a new {label} in your Discord server.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-channel-name">Name</Label>
              <Input
                id="new-channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  kind === "category" ? "Support" : "support-tickets"
                }
                autoFocus
              />
            </div>

            {kind === "text" && categories.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-channel-parent">Category (optional)</Label>
                <Select
                  items={parentItems}
                  value={parentId}
                  onValueChange={(v) => setParentId(v as string)}
                >
                  <SelectTrigger id="new-channel-parent" className="w-full">
                    <SelectValue placeholder="— No category —" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(parentItems).map(([value, itemLabel]) => (
                      <SelectItem key={value} value={value}>
                        {itemLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : `Create ${label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
