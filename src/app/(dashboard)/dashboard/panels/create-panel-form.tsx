"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, type Channel } from "@/components/channel-select";
import { createPanel } from "@/app/actions/panel";

const COLORS = ["Primary", "Secondary", "Success", "Danger"] as const;
const MAX_QUESTIONS = 5;

type QuestionDraft = {
  label: string;
  style: "short" | "paragraph";
  required: boolean;
  placeholder: string;
};

export function CreatePanelForm({ guildId }: { guildId: string }) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Channel[]>([]);
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
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [pending, startTransition] = useTransition();

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions((prev) => [
      ...prev,
      { label: "", style: "short", required: true, placeholder: "" },
    ]);
  }
  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }
  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  // Load the active guild's text channels for the channel picker.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setChannelsLoading(true);
      setChannels([]);
      setCategories([]);
      setChannelId("");
      try {
        const res = await fetch(`/api/guilds/${guildId}/channels`);
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error("channels load failed", res.status, body);
          throw new Error(String(res.status));
        }
        const data = (await res.json()) as {
          text: Channel[];
          categories: Channel[];
        };
        if (cancelled) return;
        setChannels(data.text);
        setCategories(data.categories);
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
    // Drop blank questions; require a label on the rest.
    const cleanedQuestions = questions
      .map((q) => ({ ...q, label: q.label.trim() }))
      .filter((q) => q.label.length > 0);
    if (cleanedQuestions.length !== questions.filter((q) => q.label.trim() || q.placeholder.trim()).length) {
      // A question row was started but left without a label.
      toast.error("Give every question a label, or remove it.");
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
          questions: cleanedQuestions.map((q) => ({
            label: q.label,
            style: q.style,
            required: q.required,
            placeholder: q.placeholder.trim() || undefined,
          })),
        });
        toast.success("Panel posted.");
        router.refresh();
      } catch {
        toast.error("Couldn't create the panel. Check the bot's permissions.");
      }
    });
  }

  // value -> label map so the color Select trigger shows the name, not the id.
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
            <ChannelSelect
              id="p-channel"
              guildId={guildId}
              kind="text"
              channels={channels}
              categories={categories}
              value={channelId}
              onValueChange={setChannelId}
              disabled={channelsLoading}
              placeholder={channelsLoading ? "Loading…" : "Select a channel"}
            />
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

          <div className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Form questions</p>
                <p className="text-xs text-muted-foreground">
                  Optionally ask up to {MAX_QUESTIONS} questions in a pop-up form
                  when a member opens a ticket.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
                disabled={questions.length >= MAX_QUESTIONS}
              >
                <Plus /> Add question
              </Button>
            </div>

            {questions.map((q, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={q.label}
                    onChange={(e) =>
                      updateQuestion(i, { label: e.target.value })
                    }
                    placeholder="Question (e.g. What do you need help with?)"
                    maxLength={45}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeQuestion(i)}
                    aria-label="Remove question"
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    items={{ short: "Short answer", paragraph: "Paragraph" }}
                    value={q.style}
                    onValueChange={(v) =>
                      updateQuestion(i, {
                        style: v as QuestionDraft["style"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short answer</SelectItem>
                      <SelectItem value="paragraph">Paragraph</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={q.placeholder}
                    onChange={(e) =>
                      updateQuestion(i, { placeholder: e.target.value })
                    }
                    placeholder="Placeholder (optional)"
                    maxLength={100}
                  />
                </div>
                <label className="flex w-fit items-center gap-2 text-sm">
                  <Checkbox
                    checked={q.required}
                    onCheckedChange={(v) =>
                      updateQuestion(i, { required: v === true })
                    }
                  />
                  Required
                </label>
              </div>
            ))}
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
