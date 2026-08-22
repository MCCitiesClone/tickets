"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, Hash, LayoutTemplate, Plus, Smile } from "lucide-react";
import { toast } from "sonner";

import { DiscordEmoji } from "@/components/discord-emoji";
import { EmojiAutocomplete } from "@/components/emoji-autocomplete";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PANEL_COLOR,
  type MessageTemplate,
  type TemplateEmbed,
} from "@/db/schema";
import { EmbedCard } from "./embed-card";
import { CharCount, insertAtCaret } from "./editor-utils";
import { fromDiscordJson, toDiscordJson } from "./discord-json";
import { TIME_PLACEHOLDER_META } from "@/lib/placeholders";
import { MessagePreview } from "./message-preview";
import type { EmbedPreset } from "./presets";

const MAX_EMBEDS = 10;

/**
 * Human-readable descriptions for every placeholder token, for the legend.
 * Date/time tokens are available in every substituted template, so their
 * descriptions come from the shared placeholder module.
 */
export const PLACEHOLDER_META: Record<string, string> = {
  ...TIME_PLACEHOLDER_META,
  ticket: "The ticket's number",
  number: "The ticket's number",
  username: "The opener's plain username (no mention)",
  user: "A mention of the member who opened the ticket",
  opener: "A mention of the member who opened the ticket",
  server: "The server (guild) name",
  channel: "A mention of the ticket channel",
  claimer: "A mention of the staff member who claimed it",
  closer: "A mention of whoever closed the ticket",
  reason: "The close reason, if one was given",
  transcript_url: "The shareable transcript link",
};

type GuildEmoji = { id: string; name: string; animated: boolean };

const emojiMention = (e: GuildEmoji) =>
  `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`;

export function MessageTemplateEditor({
  value,
  onChange,
  placeholders,
  presets,
  guildId,
}: {
  value: MessageTemplate;
  onChange: (next: MessageTemplate) => void;
  /** Placeholder tokens (without braces) available for this message. */
  placeholders: string[];
  /** Optional starter templates offered via "Start from a template". */
  presets?: EmbedPreset[];
  /** When set, offers an "Emoji" menu of the guild's custom emojis. */
  guildId?: string;
}) {
  // The last text field the user focused anywhere in the editor. The token
  // menu inserts into this so admins never type {tokens} by hand.
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const setContent = (content: string) => onChange({ ...value, content });

  const setEmbed = (i: number, next: TemplateEmbed) => {
    const embeds = [...value.embeds];
    embeds[i] = next;
    onChange({ ...value, embeds });
  };
  const addEmbed = () =>
    onChange({
      ...value,
      embeds: [...value.embeds, { color: DEFAULT_PANEL_COLOR }],
    });
  const removeEmbed = (i: number) =>
    onChange({ ...value, embeds: value.embeds.filter((_, j) => j !== i) });
  const moveEmbed = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.embeds.length) return;
    const embeds = [...value.embeds];
    [embeds[i], embeds[j]] = [embeds[j], embeds[i]];
    onChange({ ...value, embeds });
  };

  // Insert into whichever field was last focused; fall back to the content box.
  const insertText = (text: string) => {
    const target = lastField.current ?? contentRef.current;
    if (target) {
      insertAtCaret(target, text);
    } else {
      setContent(`${value.content ?? ""}${text}`);
    }
  };
  const insertToken = (token: string) => insertText(`{${token}}`);

  const onFocusCapture = (e: React.FocusEvent) => {
    const el = e.target;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      lastField.current = el;
    }
  };

  return (
    <EmojiAutocomplete guildId={guildId}>
      <div className="grid gap-6 lg:grid-cols-2" onFocusCapture={onFocusCapture}>
        {/* Editor */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Message content</Label>
              <div className="flex flex-wrap items-center gap-2">
                {presets && presets.length > 0 && (
                  <PresetMenu presets={presets} onApply={onChange} />
                )}
                {placeholders.length > 0 && (
                  <TokenMenu tokens={placeholders} onInsert={insertToken} />
                )}
                {guildId && (
                  <EmojiInsertMenu
                    guildId={guildId}
                    onInsert={(mention) => insertText(mention)}
                  />
                )}
                <ImportExport value={value} onImport={onChange} />
              </div>
            </div>
            <Textarea
              ref={contentRef}
              rows={3}
              value={value.content ?? ""}
              maxLength={2000}
              placeholder="Optional text shown above the embeds."
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex items-center justify-between gap-2">
              {placeholders.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {placeholders.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (contentRef.current)
                          insertAtCaret(contentRef.current, `{${p}}`);
                        else setContent(`${value.content ?? ""}{${p}}`);
                      }}
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted/70"
                      title={PLACEHOLDER_META[p] ?? `Insert {${p}}`}
                    >
                      {`{${p}}`}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <CharCount value={value.content ?? ""} max={2000} />
            </div>
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
          {placeholders.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Tokens like <code className="font-mono">{"{ticket}"}</code> are filled
              in when the message is sent.
            </p>
          )}
          {guildId && (
            <p className="mt-1 text-xs text-muted-foreground">
              Custom emoji and markdown render in the message content, embed
              titles, descriptions, and fields — Discord shows author and footer
              text plain.
            </p>
          )}
        </div>
      </div>
    </EmojiAutocomplete>
  );
}

/** "Start from a template" menu: applies a preset to the whole editor. */
function PresetMenu({
  presets,
  onApply,
}: {
  presets: EmbedPreset[];
  onApply: (next: MessageTemplate) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <LayoutTemplate className="size-3.5" /> Start from a template
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            className="flex-col items-start gap-0.5"
            onClick={() =>
              onApply({
                content: preset.template.content,
                embeds: preset.template.embeds.map((e) => ({ ...e })),
              })
            }
          >
            <span className="text-sm font-medium">{preset.label}</span>
            <span className="text-xs text-muted-foreground">
              {preset.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Insert token" menu: inserts a placeholder into the last-focused field. */
function TokenMenu({
  tokens,
  onInsert,
}: {
  tokens: string[];
  onInsert: (token: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Hash className="size-3.5" /> Insert token
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {tokens.map((token) => (
          <DropdownMenuItem
            key={token}
            className="flex-col items-start gap-0.5"
            onClick={() => onInsert(token)}
          >
            <span className="font-mono text-xs">{`{${token}}`}</span>
            {PLACEHOLDER_META[token] && (
              <span className="text-xs text-muted-foreground">
                {PLACEHOLDER_META[token]}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Emoji" menu: inserts one of the guild's custom emojis (as its `<:name:id>`
 * mention) into the last-focused field. Discord renders custom emoji in an
 * embed's description and field values (and in message content) — the same
 * places the live preview renders them.
 */
function EmojiInsertMenu({
  guildId,
  onInsert,
}: {
  guildId: string;
  onInsert: (mention: string) => void;
}) {
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/guilds/${guildId}/emojis`)
      .then((r) => (r.ok ? r.json() : { emojis: [] }))
      .then((d: { emojis?: GuildEmoji[] }) => {
        if (!cancelled) setEmojis(d.emojis ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [guildId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Smile className="size-3.5" /> Emoji
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {emojis.length === 0 ? (
          <DropdownMenuItem disabled>
            No custom emojis on this server
          </DropdownMenuItem>
        ) : (
          <div className="flex flex-wrap gap-1 p-1">
            {emojis.map((e) => (
              <button
                key={e.id}
                type="button"
                title={`:${e.name}:`}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => onInsert(emojiMention(e))}
                className="rounded p-1 hover:bg-accent"
              >
                <DiscordEmoji
                  emoji={emojiMention(e)}
                  className="inline-block size-5"
                />
              </button>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
