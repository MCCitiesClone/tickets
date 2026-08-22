"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSharedQuestion,
  deleteSharedQuestion,
  updateSharedQuestion,
} from "@/app/actions/form-question";
import { MAX_QUESTION_OPTIONS, type FormQuestion } from "@/db/schema";
import { EmptyState } from "../../page-shell";

const STYLES: Record<string, string> = {
  short: "Short answer",
  paragraph: "Paragraph",
  select: "Dropdown",
};

type Draft = {
  name: string;
  label: string;
  style: string;
  placeholder: string;
  required: boolean;
  multiple: boolean;
  options: { label: string; description: string }[];
};

const blank = (): Draft => ({
  name: "",
  label: "",
  style: "short",
  placeholder: "",
  required: true,
  multiple: false,
  options: [],
});

const toDraft = (q: FormQuestion): Draft => ({
  name: q.name,
  label: q.label,
  style: q.style,
  placeholder: q.placeholder ?? "",
  required: q.required,
  multiple: q.multiple,
  options: q.options.map((o) => ({
    label: o.label,
    description: o.description ?? "",
  })),
});

/**
 * CRUD for the guild's reusable question library. Editing happens inline on the
 * card being edited, so the list stays visible — the point of the library is
 * comparing questions against each other.
 */
export function QuestionLibrary({
  guildId,
  initial,
  usage,
}: {
  guildId: string;
  initial: FormQuestion[];
  /** Question ID → titles of the panels using it. */
  usage: Record<string, string[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** `null` = nothing open, `"new"` = the create form, otherwise a question ID. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());

  function open(id: string, next: Draft) {
    setEditing(id);
    setDraft(next);
  }

  function save() {
    const options = draft.options
      .map((o) => ({ ...o, label: o.label.trim() }))
      .filter((o) => o.label);

    const payload = {
      guildId,
      name: draft.name.trim(),
      label: draft.label.trim(),
      style: draft.style as "short" | "paragraph" | "select",
      placeholder: draft.placeholder.trim() || null,
      required: draft.required,
      multiple: draft.multiple,
      options: options.map((o) => ({
        label: o.label,
        value: o.label.slice(0, 100),
        description: o.description.trim() || undefined,
      })),
    };

    if (!payload.name || !payload.label) {
      toast.error("Give the question a name and a label.");
      return;
    }

    startTransition(async () => {
      try {
        if (editing === "new") await createSharedQuestion(payload);
        else await updateSharedQuestion({ ...payload, id: editing! });
        toast.success("Question saved.");
        setEditing(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save that.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteSharedQuestion(guildId, id);
        toast.success("Question deleted.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete that.");
      }
    });
  }

  const editor = (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-name">Name</Label>
            <Input
              id="q-name"
              value={draft.name}
              maxLength={80}
              placeholder="How you'll recognise it here"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-label">Label</Label>
            <Input
              id="q-label"
              value={draft.label}
              maxLength={45}
              placeholder="What members are asked"
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-style">Style</Label>
            <Select
              items={STYLES}
              value={draft.style}
              onValueChange={(v) => setDraft((d) => ({ ...d, style: v as string }))}
            >
              <SelectTrigger id="q-style" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STYLES).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-placeholder">Hint (optional)</Label>
            <Input
              id="q-placeholder"
              value={draft.placeholder}
              maxLength={100}
              onChange={(e) =>
                setDraft((d) => ({ ...d, placeholder: e.target.value }))
              }
            />
          </div>
        </div>

        {draft.style === "select" && (
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Choices ({draft.options.length}/{MAX_QUESTION_OPTIONS})
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={draft.options.length >= MAX_QUESTION_OPTIONS}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    options: [...d.options, { label: "", description: "" }],
                  }))
                }
              >
                <Plus className="size-4" /> Add choice
              </Button>
            </div>
            {draft.options.length === 0 && (
              <p className="text-xs text-muted-foreground">
                A dropdown needs at least one choice.
              </p>
            )}
            {draft.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={o.label}
                  maxLength={100}
                  placeholder="Choice"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x, j) =>
                        j === i ? { ...x, label: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <Input
                  value={o.description}
                  maxLength={100}
                  placeholder="Description (optional)"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove choice"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      options: d.options.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <label className="flex w-fit items-center gap-2 text-sm">
              <Checkbox
                checked={draft.multiple}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, multiple: v === true }))
                }
              />
              Allow more than one choice
            </label>
          </div>
        )}

        <label className="flex w-fit items-center gap-2 text-sm">
          <Checkbox
            checked={draft.required}
            onCheckedChange={(v) =>
              setDraft((d) => ({ ...d, required: v === true }))
            }
          />
          Required
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
            <X className="size-4" /> Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save question"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      {editing === "new" ? (
        editor
      ) : (
        <Button
          type="button"
          className="w-fit"
          onClick={() => open("new", blank())}
        >
          <Plus className="size-4" /> New question
        </Button>
      )}

      {initial.length === 0 && editing !== "new" ? (
        <EmptyState
          icon={<ListChecks className="size-8" />}
          title="No shared questions yet"
          description="Define a question once here, then add it to as many panels as you like."
        />
      ) : (
        initial.map((q) =>
          editing === q.id ? (
            <div key={q.id}>{editor}</div>
          ) : (
            <Card key={q.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {q.name}
                    <Badge variant="outline">{STYLES[q.style] ?? q.style}</Badge>
                    {!q.required && <Badge variant="outline">Optional</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {q.label}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {usage[q.id]?.length
                      ? `Used by ${usage[q.id].join(", ")}`
                      : "Not used by any panel yet"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Edit question"
                    onClick={() => open(q.id, toDraft(q))}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete question"
                    disabled={pending}
                    onClick={() => remove(q.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ),
        )
      )}
    </div>
  );
}
