"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createPanel } from "@/app/actions/panel";

const COLORS = ["Primary", "Secondary", "Success", "Danger"] as const;

type Channel = { id: string; name: string };

export function CreatePanelForm({ guildId }: { guildId: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [title, setTitle] = useState("Open a ticket");
  const [description, setDescription] = useState(
    "Click the button below to open a support ticket.",
  );
  const [buttonLabel, setButtonLabel] = useState("Open Ticket");
  const [buttonEmoji, setButtonEmoji] = useState("");
  const [buttonColor, setButtonColor] =
    useState<(typeof COLORS)[number]>("Primary");
  const [pending, startTransition] = useTransition();

  // Load the active guild's text channels for the channel picker.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setChannelsLoading(true);
      setChannels([]);
      setChannelId("");
      try {
        const res = await fetch(`/api/guilds/${guildId}/channels`);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("channels load failed", res.status, body);
          throw new Error(String(res.status));
        }
        const data = (await res.json()) as { text: Channel[] };
        if (cancelled) return;
        setChannels(data.text);
        setChannelId(data.text[0]?.id ?? "");
      } catch (err) {
        if (!cancelled)
          toast.error(
            `Couldn't load channels (${err instanceof Error ? err.message : "error"}).`,
          );
      } finally {
        if (!cancelled) setChannelsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!channelId) {
      toast.error("Pick a channel first.");
      return;
    }
    startTransition(async () => {
      try {
        await createPanel({
          guildId,
          channelId,
          title,
          description,
          buttonLabel,
          buttonEmoji: buttonEmoji || null,
          buttonColor,
        });
        toast.success("Panel posted.");
        router.refresh();
      } catch {
        toast.error("Couldn't create the panel. Check the bot's permissions.");
      }
    });
  }

  // value -> label maps so the Select triggers show names, not ids.
  const channelItems = Object.fromEntries(
    channels.map((c) => [c.id, `#${c.name}`]),
  );
  const colorItems = Object.fromEntries(COLORS.map((c) => [c, c]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a panel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-channel">Channel</Label>
            <Select
              items={channelItems}
              value={channelId}
              onValueChange={(v) => setChannelId(v as string)}
              disabled={channelsLoading || channels.length === 0}
            >
              <SelectTrigger id="p-channel" className="w-full">
                <SelectValue
                  placeholder={
                    channelsLoading
                      ? "Loading…"
                      : channels.length === 0
                        ? "No channels"
                        : "Select a channel"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    #{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-title">Title</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-label">Button label</Label>
              <Input
                id="p-label"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-emoji">Button emoji</Label>
              <Input
                id="p-emoji"
                value={buttonEmoji}
                onChange={(e) => setButtonEmoji(e.target.value)}
                placeholder="🎫 (optional)"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-color">Button color</Label>
              <Select
                items={colorItems}
                value={buttonColor}
                onValueChange={(v) =>
                  setButtonColor(v as (typeof COLORS)[number])
                }
              >
                <SelectTrigger id="p-color" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending || !channelId}>
              {pending ? "Posting…" : "Create & post panel"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
