"use client";

import { useState } from "react";
import { Code2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MessageTemplate, TemplateEmbed } from "@/db/schema";
import { EmbedCard } from "./embed-card";
import { fromDiscordJson, toDiscordJson } from "./discord-json";
import { MessagePreview } from "./message-preview";

const MAX_EMBEDS = 10;

export function MessageTemplateEditor({
  value,
  onChange,
  placeholders,
}: {
  value: MessageTemplate;
  onChange: (next: MessageTemplate) => void;
  /** Placeholder tokens (without braces) available for this message. */
  placeholders: string[];
}) {
  const setContent = (content: string) => onChange({ ...value, content });

  const setEmbed = (i: number, next: TemplateEmbed) => {
    const embeds = [...value.embeds];
    embeds[i] = next;
    onChange({ ...value, embeds });
  };
  const addEmbed = () =>
    onChange({ ...value, embeds: [...value.embeds, {}] });
  const removeEmbed = (i: number) =>
    onChange({ ...value, embeds: value.embeds.filter((_, j) => j !== i) });
  const moveEmbed = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.embeds.length) return;
    const embeds = [...value.embeds];
    [embeds[i], embeds[j]] = [embeds[j], embeds[i]];
    onChange({ ...value, embeds });
  };

  const insertPlaceholder = (token: string) =>
    setContent(`${value.content ?? ""}{${token}}`);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Message content</Label>
            <ImportExport value={value} onImport={onChange} />
          </div>
          <Textarea
            rows={3}
            value={value.content ?? ""}
            maxLength={2000}
            placeholder="Optional text shown above the embeds."
            onChange={(e) => setContent(e.target.value)}
          />
          {placeholders.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {placeholders.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => insertPlaceholder(p)}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted/70"
                  title={`Insert {${p}}`}
                >
                  {`{${p}}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {value.embeds.map((embed, i) => (
          <EmbedCard
            key={i}
            embed={embed}
            index={i}
            total={value.embeds.length}
            onChange={(next) => setEmbed(i, next)}
            onRemove={() => removeEmbed(i)}
            onMove={(dir) => moveEmbed(i, dir)}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          disabled={value.embeds.length >= MAX_EMBEDS}
          onClick={addEmbed}
        >
          <Plus className="size-4" /> Add embed ({value.embeds.length}/
          {MAX_EMBEDS})
        </Button>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Label className="mb-2 block text-xs text-muted-foreground">
          Preview
        </Label>
        <MessagePreview template={value} />
      </div>
    </div>
  );
}

function ImportExport({
  value,
  onImport,
}: {
  value: MessageTemplate;
  onImport: (next: MessageTemplate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function onOpenChange(next: boolean) {
    if (next) setDraft(toDiscordJson(value));
    setOpen(next);
  }

  function apply() {
    try {
      onImport(fromDiscordJson(draft));
      toast.success("Imported message JSON.");
      setOpen(false);
    } catch {
      toast.error("That doesn't look like valid message JSON.");
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(toDiscordJson(value)).catch(() => {});
    toast.success("Copied JSON to clipboard.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Code2 className="size-3.5" /> JSON
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import / export message JSON</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Compatible with embed-generator and Discohook. Paste JSON to import, or
          copy the current message to edit it there.
        </p>
        <Textarea
          rows={14}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="font-mono text-xs"
          spellCheck={false}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={copy}>
            Copy
          </Button>
          <Button type="button" onClick={apply}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
