"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EmbedField, TemplateEmbed } from "@/db/schema";
import { DEFAULT_PANEL_COLOR, isEmbedEmpty } from "@/db/schema";
import { CharCount } from "./editor-utils";

const intToHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const hexToInt = (h: string) => parseInt(h.replace("#", ""), 16) || 0;

function Labeled({
  label,
  count,
  children,
}: {
  label: string;
  count?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {count}
      </div>
      {children}
    </div>
  );
}

/** Short summary of which advanced fields are populated, for the expander. */
function advancedSummary(embed: TemplateEmbed): string {
  const parts: string[] = [];
  if (embed.author?.name) parts.push("author");
  if (embed.url) parts.push("title link");
  if (embed.thumbnail?.url) parts.push("thumbnail");
  if (embed.fields?.length)
    parts.push(`${embed.fields.length} field${embed.fields.length > 1 ? "s" : ""}`);
  if (embed.footer?.text) parts.push("footer");
  if (embed.timestamp) parts.push("timestamp");
  return parts.join(" · ");
}

export function EmbedCard({
  embed,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  embed: TemplateEmbed;
  index: number;
  total: number;
  onChange: (next: TemplateEmbed) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const patch = (p: Partial<TemplateEmbed>) => onChange({ ...embed, ...p });

  const setField = (i: number, p: Partial<EmbedField>) => {
    const fields = [...(embed.fields ?? [])];
    fields[i] = { ...fields[i], ...p };
    patch({ fields });
  };
  const addField = () =>
    patch({
      fields: [...(embed.fields ?? []), { name: "", value: "", inline: false }],
    });
  const removeField = (i: number) =>
    patch({ fields: (embed.fields ?? []).filter((_, j) => j !== i) });

  const summary = advancedSummary(embed);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Embed {index + 1}</span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {isEmbedEmpty(embed) && (
        <p className="text-xs text-muted-foreground">
          This embed is empty — add a title or description below.
        </p>
      )}

      {/* Simple fields — always visible */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Labeled
          label="Title"
          count={<CharCount value={embed.title ?? ""} max={256} />}
        >
          <Input
            value={embed.title ?? ""}
            maxLength={256}
            onChange={(e) => patch({ title: e.target.value || undefined })}
          />
        </Labeled>
        <Labeled label="Colour">
          <input
            type="color"
            className="h-9 w-16 cursor-pointer rounded-lg border border-input bg-background"
            value={intToHex(embed.color ?? DEFAULT_PANEL_COLOR)}
            onChange={(e) => patch({ color: hexToInt(e.target.value) })}
          />
        </Labeled>
      </div>

      <Labeled
        label="Description"
        count={<CharCount value={embed.description ?? ""} max={4096} />}
      >
        <Textarea
          rows={3}
          value={embed.description ?? ""}
          maxLength={4096}
          onChange={(e) => patch({ description: e.target.value || undefined })}
        />
      </Labeled>

      <Labeled label="Image URL">
        <Input
          value={embed.image?.url ?? ""}
          placeholder="https://…/image.png"
          onChange={(e) =>
            patch({ image: e.target.value ? { url: e.target.value } : undefined })
          }
        />
      </Labeled>

      {/* Advanced fields — collapsed by default */}
      <details className="group rounded-md border bg-muted/20 px-3 py-2 [&_summary]:list-none">
        <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>Advanced options{summary && ` · ${summary}`}</span>
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>

        <div className="mt-3 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Author name">
              <Input
                value={embed.author?.name ?? ""}
                maxLength={256}
                onChange={(e) =>
                  patch({
                    author: e.target.value
                      ? { ...embed.author, name: e.target.value }
                      : undefined,
                  })
                }
              />
            </Labeled>
            <Labeled label="Author icon URL">
              <Input
                value={embed.author?.iconUrl ?? ""}
                placeholder="https://…"
                onChange={(e) =>
                  patch({
                    author: {
                      name: embed.author?.name ?? "",
                      ...embed.author,
                      iconUrl: e.target.value || undefined,
                    },
                  })
                }
              />
            </Labeled>
          </div>

          <Labeled label="Title link URL">
            <Input
              value={embed.url ?? ""}
              placeholder="https://…"
              onChange={(e) => patch({ url: e.target.value || undefined })}
            />
          </Labeled>

          <Labeled label="Thumbnail URL">
            <Input
              value={embed.thumbnail?.url ?? ""}
              placeholder="https://…/thumb.png"
              onChange={(e) =>
                patch({
                  thumbnail: e.target.value
                    ? { url: e.target.value }
                    : undefined,
                })
              }
            />
          </Labeled>

          {/* Fields */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Fields ({embed.fields?.length ?? 0}/25)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={(embed.fields?.length ?? 0) >= 25}
                onClick={addField}
              >
                <Plus className="size-3.5" /> Field
              </Button>
            </div>
            {(embed.fields ?? []).map((field, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border p-2">
                <div className="flex items-start gap-2">
                  <Input
                    placeholder="Name"
                    value={field.name}
                    maxLength={256}
                    onChange={(e) => setField(i, { name: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(i)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Value"
                  rows={2}
                  value={field.value}
                  maxLength={1024}
                  onChange={(e) => setField(i, { value: e.target.value })}
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={field.inline ?? false}
                      onCheckedChange={(v) => setField(i, { inline: v === true })}
                    />
                    Inline
                  </label>
                  <CharCount value={field.value} max={1024} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled
              label="Footer text"
              count={<CharCount value={embed.footer?.text ?? ""} max={2048} />}
            >
              <Input
                value={embed.footer?.text ?? ""}
                maxLength={2048}
                onChange={(e) =>
                  patch({
                    footer: e.target.value
                      ? { ...embed.footer, text: e.target.value }
                      : undefined,
                  })
                }
              />
            </Labeled>
            <Labeled label="Footer icon URL">
              <Input
                value={embed.footer?.iconUrl ?? ""}
                placeholder="https://…"
                onChange={(e) =>
                  patch({
                    footer: {
                      text: embed.footer?.text ?? "",
                      ...embed.footer,
                      iconUrl: e.target.value || undefined,
                    },
                  })
                }
              />
            </Labeled>
          </div>

          <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={Boolean(embed.timestamp)}
              onCheckedChange={(v) =>
                patch({
                  timestamp: v === true ? new Date().toISOString() : undefined,
                })
              }
            />
            Show a timestamp (posts the current time)
          </label>
        </div>
      </details>
    </div>
  );
}
