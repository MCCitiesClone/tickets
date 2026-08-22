"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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
import { ChannelSelect, CHANNEL_NONE, type Channel } from "@/components/channel-select";
import { EmojiPicker } from "@/components/emoji-picker";
import { RoleMultiSelect, type Role } from "@/components/role-multi-select";
import {
  DEFAULT_PANEL_COLOR,
  type FormQuestion,
  isTemplateEmpty,
  MAX_QUESTION_OPTIONS,
  type AccessRule,
  type MessageTemplate,
  type Panel,
} from "@/db/schema";
import { MessageTemplateEditor } from "@/components/message-editor/message-template-editor";
import { TIME_PLACEHOLDERS } from "@/lib/placeholders";
import { presetsFor } from "@/components/message-editor/presets";
import { createPanel, updatePanel } from "@/app/actions/panel";

const WELCOME_PLACEHOLDERS = [
  "ticket",
  "username",
  "user",
  "server",
  "channel",
  ...TIME_PLACEHOLDERS,
];

const COLORS = ["Primary", "Secondary", "Success", "Danger"] as const;
const MAX_QUESTIONS = 5;

type OptionDraft = { label: string; description: string };

/**
 * Editing shape for a question. `options` and `multiple` are carried for every
 * draft, not just dropdowns, so switching style back and forth doesn't discard
 * what the admin already typed; only the relevant half is submitted.
 */
type QuestionDraft = {
  label: string;
  style: "short" | "paragraph" | "select";
  required: boolean;
  placeholder: string;
  options: OptionDraft[];
  multiple: boolean;
};

const QUESTION_STYLES: Record<QuestionDraft["style"], string> = {
  short: "Short answer",
  paragraph: "Paragraph",
  select: "Dropdown",
};

const intToHex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const hexToInt = (h: string) => parseInt(h.replace("#", ""), 16) || 0;

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

export function PanelForm({
  guildId,
  panel,
  sharedQuestions = [],
}: {
  guildId: string;
  /** When provided, the form edits this panel; otherwise it creates a new one. */
  panel?: Panel;
  /** The guild's reusable question library, for the picker. */
  sharedQuestions?: FormQuestion[];
}) {
  const router = useRouter();
  const isEdit = Boolean(panel);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);

  // Panel message. New panels default to a channel (auto-selected on load);
  // existing panels keep their channel, or CHANNEL_NONE if they aren't posted.
  const [channelId, setChannelId] = useState(
    panel ? (panel.channelId ?? CHANNEL_NONE) : "",
  );
  const [title, setTitle] = useState(panel?.title ?? "Open a ticket");
  const [description, setDescription] = useState(
    panel?.description ?? "Click the button below to open a support ticket.",
  );
  const [color, setColor] = useState(panel?.color ?? DEFAULT_PANEL_COLOR);
  const [largeImageUrl, setLargeImageUrl] = useState(panel?.largeImageUrl ?? "");
  const [smallImageUrl, setSmallImageUrl] = useState(panel?.smallImageUrl ?? "");
  const [disabled, setDisabled] = useState(panel?.disabled ?? false);

  // Button
  const [buttonLabel, setButtonLabel] = useState(panel?.buttonLabel ?? "Open Ticket");
  const [buttonEmoji, setButtonEmoji] = useState(panel?.buttonEmoji ?? "");
  const [buttonColor, setButtonColor] = useState<(typeof COLORS)[number]>(
    (panel?.buttonColor as (typeof COLORS)[number]) ?? "Primary",
  );

  // Ticket behavior
  const [categoryId, setCategoryId] = useState(panel?.categoryId ?? CHANNEL_NONE);
  const [namingScheme, setNamingScheme] = useState(panel?.namingScheme ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(panel?.welcomeMessage ?? "");
  const [welcomeTemplate, setWelcomeTemplate] = useState<MessageTemplate>(
    panel?.welcomeTemplate ?? { embeds: [] },
  );
  const [supportRoleIds, setSupportRoleIds] = useState<string[]>(
    panel?.supportRoleIds ?? [],
  );
  const [mentionRoleIds, setMentionRoleIds] = useState<string[]>(
    panel?.mentionRoleIds ?? [],
  );
  const [cooldownSeconds, setCooldownSeconds] = useState(
    panel?.cooldownSeconds ?? 0,
  );
  const [hideClaim, setHideClaim] = useState(panel?.hideClaim ?? false);
  const [hideClose, setHideClose] = useState(panel?.hideClose ?? false);
  const [hideCloseWithReason, setHideCloseWithReason] = useState(
    panel?.hideCloseWithReason ?? false,
  );
  const [accessControl, setAccessControl] = useState<AccessRule[]>(
    panel?.accessControl ?? [],
  );

  const [sharedQuestionIds, setSharedQuestionIds] = useState<string[]>(
    panel?.sharedQuestionIds ?? [],
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    panel?.questions.map((q) => ({
      label: q.label,
      style: q.style,
      required: q.required,
      placeholder: q.placeholder ?? "",
      options:
        q.style === "select"
          ? q.options.map((o) => ({
              label: o.label,
              description: o.description ?? "",
            }))
          : [],
      multiple: q.style === "select" ? q.multiple : false,
    })) ?? [],
  );

  const [pending, startTransition] = useTransition();

  // Load the guild's channels + roles for the pickers.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [chRes, roleRes] = await Promise.all([
          fetch(`/api/guilds/${guildId}/channels`),
          fetch(`/api/guilds/${guildId}/roles`),
        ]);
        if (!chRes.ok || !roleRes.ok) throw new Error("load failed");
        const ch = (await chRes.json()) as {
          text: Channel[];
          categories: Channel[];
        };
        const rl = (await roleRes.json()) as { roles: Role[] };
        if (cancelled) return;
        setChannels(ch.text);
        setCategories(ch.categories);
        setRoles(rl.roles);
        if (!panel) setChannelId((c) => c || ch.text[0]?.id || "");
      } catch {
        if (!cancelled) toast.error("Couldn't load channels/roles.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [guildId, panel]);

  function addQuestion() {
    if (totalQuestions >= MAX_QUESTIONS) return;
    setQuestions((p) => [
      ...p,
      {
        label: "",
        style: "short",
        required: true,
        placeholder: "",
        options: [],
        multiple: false,
      },
    ]);
  }

  function updateOption(qi: number, oi: number, patch: Partial<OptionDraft>) {
    setQuestions((p) =>
      p.map((q, idx) =>
        idx === qi
          ? {
              ...q,
              options: q.options.map((o, j) =>
                j === oi ? { ...o, ...patch } : o,
              ),
            }
          : q,
      ),
    );
  }
  const addOption = (qi: number) =>
    setQuestions((p) =>
      p.map((q, idx) =>
        idx === qi && q.options.length < MAX_QUESTION_OPTIONS
          ? { ...q, options: [...q.options, { label: "", description: "" }] }
          : q,
      ),
    );
  const removeOption = (qi: number, oi: number) =>
    setQuestions((p) =>
      p.map((q, idx) =>
        idx === qi
          ? { ...q, options: q.options.filter((_, j) => j !== oi) }
          : q,
      ),
    );
  const updateQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    setQuestions((p) => p.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const removeQuestion = (i: number) =>
    setQuestions((p) => p.filter((_, idx) => idx !== i));

  const addRule = () =>
    setAccessControl((p) => [...p, { roleId: "", action: "allow" }]);
  const updateRule = (i: number, patch: Partial<AccessRule>) =>
    setAccessControl((p) =>
      p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  const removeRule = (i: number) =>
    setAccessControl((p) => p.filter((_, idx) => idx !== i));

  // Discord's five-field modal limit spans both lists.
  const totalQuestions = sharedQuestionIds.length + questions.length;

  const postChannelId =
    channelId && channelId !== CHANNEL_NONE ? channelId : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedQuestions = questions
      .map((q) => ({
        ...q,
        label: q.label.trim(),
        options: q.options
          .map((o) => ({ ...o, label: o.label.trim() }))
          .filter((o) => o.label.length > 0),
      }))
      .filter((q) => q.label.length > 0)
      // A dropdown with nothing to choose from can't be rendered, so drop it
      // rather than letting the server action reject the whole save.
      .filter((q) => q.style !== "select" || q.options.length > 0);

    const payload = {
      guildId,
      channelId: postChannelId,
      title,
      description,
      color,
      largeImageUrl: largeImageUrl.trim() || null,
      smallImageUrl: smallImageUrl.trim() || null,
      buttonLabel,
      buttonEmoji: buttonEmoji.trim() || null,
      buttonColor,
      disabled,
      categoryId: categoryId === CHANNEL_NONE ? null : categoryId,
      namingScheme: namingScheme.trim() || null,
      welcomeMessage: welcomeMessage.trim() || null,
      welcomeTemplate: isTemplateEmpty(welcomeTemplate) ? null : welcomeTemplate,
      supportRoleIds,
      mentionRoleIds,
      cooldownSeconds,
      hideClaim,
      hideClose,
      hideCloseWithReason,
      accessControl: accessControl.filter((r) => r.roleId),
      sharedQuestionIds,
      questions: cleanedQuestions.map((q) => {
        const base = {
          label: q.label,
          required: q.required,
          placeholder: q.placeholder.trim() || undefined,
        };
        return q.style === "select"
          ? {
              ...base,
              style: "select" as const,
              multiple: q.multiple,
              // The label doubles as the stored value: admins think in labels,
              // and the answer is recorded by label anyway.
              options: q.options.map((o) => ({
                label: o.label,
                value: o.label.slice(0, 100),
                description: o.description.trim() || undefined,
              })),
            }
          : { ...base, style: q.style };
      }),
    };

    startTransition(async () => {
      try {
        if (panel) {
          await updatePanel({ ...payload, panelId: panel.id });
          toast.success("Panel updated.");
        } else {
          await createPanel(payload);
          toast.success("Panel posted.");
        }
        router.push("/dashboard/panels");
        router.refresh();
      } catch {
        toast.error(
          `Couldn't ${isEdit ? "update" : "create"} the panel. Check the bot's permissions.`,
        );
      }
    });
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Panel message */}
      <Card>
        <CardHeader>
          <CardTitle>Panel message</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Channel"
            hint="Where the panel is posted. Choose “Don't post” to use this panel only inside a multi-panel."
          >
            <ChannelSelect
              guildId={guildId}
              kind="text"
              channels={channels}
              categories={categories}
              value={channelId}
              onValueChange={setChannelId}
              disabled={loading}
              allowNone
              noneLabel="— Don't post (multi-panel only) —"
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
          <label className="flex w-fit items-center gap-2 text-sm">
            <Checkbox
              checked={disabled}
              onCheckedChange={(v) => setDisabled(v === true)}
            />
            Disable this panel (button shown but opening is blocked)
          </label>
        </CardContent>
      </Card>

      {/* Button */}
      <Card>
        <CardHeader>
          <CardTitle>Button</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Label">
              <Input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} maxLength={80} />
            </Field>
            <Field
              label="Emoji"
              hint="Pick a server emoji, or paste a unicode emoji."
            >
              <EmojiPicker
                guildId={guildId}
                value={buttonEmoji}
                onChange={setButtonEmoji}
              />
            </Field>
            <Field label="Colour">
              <Select
                items={Object.fromEntries(COLORS.map((c) => [c, c]))}
                value={buttonColor}
                onValueChange={(v) => setButtonColor(v as (typeof COLORS)[number])}
              >
                <SelectTrigger className="w-full">
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
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Ticket behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Ticket behaviour</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field
            label="Ticket category"
            hint="Overrides the server default for tickets from this panel."
          >
            <ChannelSelect
              guildId={guildId}
              kind="category"
              channels={categories}
              value={categoryId}
              onValueChange={setCategoryId}
              allowNone
              noneLabel="— Server default —"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Naming scheme"
              hint="Blank = server default. {number} / {username}."
            >
              <Input
                value={namingScheme}
                onChange={(e) => setNamingScheme(e.target.value)}
                placeholder="ticket-{number}"
              />
            </Field>
            <Field
              label="Cooldown (seconds)"
              hint="Per user. 0 disables. Staff are exempt."
            >
              <Input
                type="number"
                min={0}
                max={86400}
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field
            label="Welcome message"
            hint="Blank = server default. Shown as the first message in the ticket."
          >
            <Textarea
              rows={2}
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              maxLength={4096}
            />
          </Field>
          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Rich welcome (embed editor)
            </summary>
            <p className="mb-3 mt-2 text-xs text-muted-foreground">
              When set, this overrides the plain welcome above and the server
              default. Leave empty to inherit.
            </p>
            <MessageTemplateEditor
              value={welcomeTemplate}
              onChange={setWelcomeTemplate}
              placeholders={WELCOME_PLACEHOLDERS}
              presets={presetsFor("panelWelcome")}
              guildId={guildId}
            />
          </details>
          <Field
            label="Support roles"
            hint="Roles that can see/handle tickets from this panel. Blank = server staff roles."
          >
            <RoleMultiSelect roles={roles} value={supportRoleIds} onChange={setSupportRoleIds} />
          </Field>
          <Field label="Mention on open" hint="Roles pinged when a ticket opens.">
            <RoleMultiSelect roles={roles} value={mentionRoleIds} onChange={setMentionRoleIds} />
          </Field>
          <div className="flex flex-col gap-2">
            <Label>Ticket buttons</Label>
            <label className="flex w-fit items-center gap-2 text-sm">
              <Checkbox checked={hideClaim} onCheckedChange={(v) => setHideClaim(v === true)} />
              Hide Claim button
            </label>
            <label className="flex w-fit items-center gap-2 text-sm">
              <Checkbox checked={hideClose} onCheckedChange={(v) => setHideClose(v === true)} />
              Hide Close button
            </label>
            <label className="flex w-fit items-center gap-2 text-sm">
              <Checkbox
                checked={hideCloseWithReason}
                onCheckedChange={(v) => setHideCloseWithReason(v === true)}
              />
              Hide Close-with-reason button
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Access control */}
      <Card>
        <CardHeader>
          <CardTitle>Access control</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Rules are evaluated top-to-bottom; the first matching role wins. With
            no rules, anyone can open. If you add only allow rules, everyone else
            is denied.
          </p>
          {accessControl.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                items={{ allow: "Allow", deny: "Deny" }}
                value={rule.action}
                onValueChange={(v) =>
                  updateRule(i, { action: v as AccessRule["action"] })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="deny">Deny</SelectItem>
                </SelectContent>
              </Select>
              <Select
                items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
                value={rule.roleId}
                onValueChange={(v) => updateRule(i, { roleId: v as string })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role">
                    {rule.roleId ? roleName(rule.roleId) : "Select a role"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeRule(i)}
                aria-label="Remove rule"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addRule} className="w-fit">
            <Plus /> Add rule
          </Button>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Form questions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Optionally ask up to {MAX_QUESTIONS} questions in a pop-up form when
              a member opens a ticket. Shared questions are asked first, then this
              panel&apos;s own.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addQuestion}
              disabled={totalQuestions >= MAX_QUESTIONS}
            >
              <Plus /> Add question
            </Button>
          </div>
          {sharedQuestions.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Shared questions</Label>
                <Link
                  href="/dashboard/questions"
                  className="text-xs text-primary hover:underline"
                >
                  Manage library
                </Link>
              </div>
              {sharedQuestions.map((q) => {
                const checked = sharedQuestionIds.includes(q.id);
                // Only block *adding* at the cap, so an over-full panel can
                // still be pruned back down.
                const atCap = totalQuestions >= MAX_QUESTIONS && !checked;
                return (
                  <label
                    key={q.id}
                    className="flex items-start gap-2 text-sm data-disabled:opacity-50"
                    data-disabled={atCap || undefined}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={atCap}
                      onCheckedChange={(v) =>
                        setSharedQuestionIds((p) =>
                          v === true
                            ? [...p, q.id]
                            : p.filter((id) => id !== q.id),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{q.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {q.label}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {totalQuestions > MAX_QUESTIONS && (
            <p className="rounded-md bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-400">
              That&apos;s {totalQuestions} questions — Discord only shows{" "}
              {MAX_QUESTIONS}. The extras won&apos;t be asked.
            </p>
          )}

          {questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={q.label}
                  onChange={(e) => updateQuestion(i, { label: e.target.value })}
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
                  items={QUESTION_STYLES}
                  value={q.style}
                  onValueChange={(v) =>
                    updateQuestion(i, { style: v as QuestionDraft["style"] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(QUESTION_STYLES).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={q.placeholder}
                  onChange={(e) => updateQuestion(i, { placeholder: e.target.value })}
                  placeholder={
                    q.style === "select"
                      ? "Hint under the label (optional)"
                      : "Placeholder (optional)"
                  }
                  maxLength={100}
                />
              </div>

              {q.style === "select" && (
                <div className="flex flex-col gap-2 rounded-md border bg-background/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Choices ({q.options.length}/{MAX_QUESTION_OPTIONS})
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addOption(i)}
                      disabled={q.options.length >= MAX_QUESTION_OPTIONS}
                    >
                      <Plus /> Add choice
                    </Button>
                  </div>

                  {q.options.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      A dropdown needs at least one choice, or it won&apos;t be
                      asked.
                    </p>
                  ) : (
                    q.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <Input
                          value={o.label}
                          onChange={(e) =>
                            updateOption(i, oi, { label: e.target.value })
                          }
                          placeholder="Choice"
                          maxLength={100}
                        />
                        <Input
                          value={o.description}
                          onChange={(e) =>
                            updateOption(i, oi, { description: e.target.value })
                          }
                          placeholder="Description (optional)"
                          maxLength={100}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeOption(i, oi)}
                          aria-label="Remove choice"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))
                  )}

                  <label className="flex w-fit items-center gap-2 text-sm">
                    <Checkbox
                      checked={q.multiple}
                      onCheckedChange={(v) =>
                        updateQuestion(i, { multiple: v === true })
                      }
                    />
                    Allow more than one choice
                  </label>
                </div>
              )}

              <label className="flex w-fit items-center gap-2 text-sm">
                <Checkbox
                  checked={q.required}
                  onCheckedChange={(v) => updateQuestion(i, { required: v === true })}
                />
                Required
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : postChannelId
                ? "Create & post panel"
                : "Create panel"}
        </Button>
      </div>
    </form>
  );
}
