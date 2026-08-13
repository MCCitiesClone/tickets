"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, type Channel } from "@/components/channel-select";
import { DiscordEmoji } from "@/components/discord-emoji";
import { DEFAULT_PANEL_COLOR, type MultiPanel } from "@/db/schema";
import {
  createMultiPanel,
  updateMultiPanel,
} from "@/app/actions/multi-panel";

const intToHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const hexToInt = (h: string) => parseInt(h.replace("#", ""), 16) || 0;

export type PanelOption = {
  id: string;
  name: string;
  emoji?: string | null;
  color?: string;
};

/** Discord button style → a preview background class. */
const BUTTON_COLORS: Record<string, string> = {
  Primary: "bg-indigo-500",
  Secondary: "bg-neutral-600",
  Success: "bg-green-600",
  Danger: "bg-red-600",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function MultiPanelForm({
  guildId,
  availablePanels,
  multiPanel,
}: {
  guildId: string;
  availablePanels: PanelOption[];
  multiPanel?: MultiPanel;
}) {
  const router = useRouter();
  const isEdit = Boolean(multiPanel);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  const [channelId, setChannelId] = useState(multiPanel?.channelId ?? "");
  const [title, setTitle] = useState(multiPanel?.title ?? "Open a ticket");
  const [description, setDescription] = useState(
    multiPanel?.description ??
      "Select the type of ticket you'd like to open below.",
  );
  const [color, setColor] = useState(multiPanel?.color ?? DEFAULT_PANEL_COLOR);
  const [panelIds, setPanelIds] = useState<string[]>(
    multiPanel?.panelIds ?? [],
  );
  const [useDropdown, setUseDropdown] = useState(
    multiPanel?.useDropdown ?? false,
  );
  const [largeImageUrl, setLargeImageUrl] = useState(
    multiPanel?.largeImageUrl ?? "",
  );
  const [smallImageUrl, setSmallImageUrl] = useState(
    multiPanel?.smallImageUrl ?? "",
  );

  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/guilds/${guildId}/channels`);
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as {
          text: Channel[];
          categories: Channel[];
        };
        if (cancelled) return;
        setChannels(data.text);
        setCategories(data.categories);
        if (!multiPanel) setChannelId((c) => c || data.text[0]?.id || "");
      } catch {
        if (!cancelled) toast.error("Couldn't load channels.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [guildId, multiPanel]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!channelId) {
      toast.error("Pick a channel to post the multi-panel in.");
      return;
    }
    if (panelIds.length === 0) {
      toast.error("Select at least one panel to include.");
      return;
    }
    const payload = {
      guildId,
      channelId,
      title,
      description,
      color,
      largeImageUrl: largeImageUrl.trim() || null,
      smallImageUrl: smallImageUrl.trim() || null,
      useDropdown,
      panelIds,
    };
    startTransition(async () => {
      try {
        if (multiPanel) {
          await updateMultiPanel({ ...payload, multiPanelId: multiPanel.id });
          toast.success("Multi-panel updated.");
        } else {
          await createMultiPanel(payload);
          toast.success("Multi-panel posted.");
        }
        router.push("/dashboard/panels");
        router.refresh();
      } catch {
        toast.error(
          `Couldn't ${isEdit ? "update" : "create"} the multi-panel. Check the bot's permissions.`,
        );
      }
    });
  }

  function togglePanel(id: string, checked: boolean) {
    setPanelIds((prev) =>
      checked ? [...prev, id] : prev.filter((p) => p !== id),
    );
  }

  const selectedPanels = panelIds
    .map((id) => availablePanels.find((p) => p.id === id))
    .filter((p): p is PanelOption => Boolean(p));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Multi-panel message</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Channel" hint="Where the multi-panel message is posted.">
            <ChannelSelect
              guildId={guildId}
              kind="text"
              channels={channels}
              categories={categories}
              value={channelId}
              onValueChange={setChannelId}
              disabled={loading}
              placeholder={loading ? "Loading…" : "Select a channel"}
            />
          </Field>
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={255} />
          </Field>
          <Field label="Content">
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1024}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Colour">
              <input
                type="color"
                className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background"
                value={intToHex(color)}
                onChange={(e) => setColor(hexToInt(e.target.value))}
              />
            </Field>
            <Field label="Large image URL">
              <Input
                value={largeImageUrl}
                onChange={(e) => setLargeImageUrl(e.target.value)}
                placeholder="https://…/image.png"
              />
            </Field>
            <Field label="Small image URL">
              <Input
                value={smallImageUrl}
                onChange={(e) => setSmallImageUrl(e.target.value)}
                placeholder="https://…/image.png"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Panels</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Included panels"
            hint="Pick the individual panels to combine into this message."
          >
            {availablePanels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No panels yet — create individual panels first.
              </p>
            ) : (
              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
                {availablePanels.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={panelIds.includes(p.id)}
                      onCheckedChange={(v) => togglePanel(p.id, v === true)}
                    />
                    <DiscordEmoji emoji={p.emoji} />
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>
          <label className="flex w-fit items-center gap-2 text-sm">
            <Checkbox
              checked={useDropdown}
              onCheckedChange={(v) => setUseDropdown(v === true)}
            />
            Show options as a dropdown menu (instead of buttons)
          </label>

          <Field label="Preview" hint="How the options appear in Discord.">
            {selectedPanels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select panels to preview.
              </p>
            ) : useDropdown ? (
              <div className="w-full max-w-sm overflow-hidden rounded-lg border text-sm">
                <div className="border-b px-3 py-2 text-muted-foreground">
                  Select a ticket type…
                </div>
                {selectedPanels.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    <DiscordEmoji emoji={p.emoji} />
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedPanels.map((p) => (
                  <span
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-white ${
                      BUTTON_COLORS[p.color ?? "Primary"] ?? BUTTON_COLORS.Primary
                    }`}
                  >
                    <DiscordEmoji emoji={p.emoji} />
                    {p.name}
                  </span>
                ))}
              </div>
            )}
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending || !channelId}>
          {pending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : "Create & post multi-panel"}
        </Button>
      </div>
    </form>
  );
}
