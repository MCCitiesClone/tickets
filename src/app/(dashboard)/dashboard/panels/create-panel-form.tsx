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
import { Textarea } from "@/components/ui/textarea";
import { createPanel } from "@/app/actions/panel";
import type { ManageableGuild } from "@/lib/guild-access";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const COLORS = ["Primary", "Secondary", "Success", "Danger"] as const;

type Channel = { id: string; name: string };

export function CreatePanelForm({ guilds }: { guilds: ManageableGuild[] }) {
  const router = useRouter();
  const [guildId, setGuildId] = useState(guilds[0]?.id ?? "");
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

  // Load the selected guild's text channels for the channel picker.
  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;

    async function load() {
      setChannelsLoading(true);
      setChannels([]);
      setChannelId("");
      try {
        const res = await fetch(`/api/guilds/${guildId}/channels`);
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as { text: Channel[] };
        if (cancelled) return;
        setChannels(data.text);
        setChannelId(data.text[0]?.id ?? "");
      } catch {
        if (!cancelled) toast.error("Couldn't load channels for that server.");
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
    if (!guildId || !channelId) {
      toast.error("Pick a server and a channel first.");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a panel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-guild">Server</Label>
              <select
                id="p-guild"
                className={selectClass}
                value={guildId}
                onChange={(e) => setGuildId(e.target.value)}
              >
                {guilds.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-channel">Channel</Label>
              <select
                id="p-channel"
                className={selectClass}
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                disabled={channelsLoading || channels.length === 0}
              >
                {channelsLoading ? (
                  <option>Loading…</option>
                ) : channels.length === 0 ? (
                  <option value="">No channels</option>
                ) : (
                  channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))
                )}
              </select>
            </div>
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
              <select
                id="p-color"
                className={selectClass}
                value={buttonColor}
                onChange={(e) =>
                  setButtonColor(e.target.value as (typeof COLORS)[number])
                }
              >
                {COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
