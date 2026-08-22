"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { ChannelSelect, CHANNEL_NONE } from "@/components/channel-select";
import type { Guild } from "@/db/schema";
import type { DiscordChannel } from "@/lib/discord-api";
import { updateGuildConfig } from "@/app/actions/guild";
import { DAY_NAMES, type SupportInterval } from "@/lib/support-hours";

/** Matches the server action's cap on the configured reason list. */
const MAX_CLOSE_REASONS = 25;

const DAY_ITEMS: Record<string, string> = Object.fromEntries(
  // Monday first: opening hours read more naturally that way.
  [1, 2, 3, 4, 5, 6, 0].map((d) => [String(d), DAY_NAMES[d]]),
);

const WEEKDAYS_9_TO_5: SupportInterval[] = [1, 2, 3, 4, 5].map((day) => ({
  day,
  start: "09:00",
  end: "17:00",
}));

/** A short list of common zones for the input's datalist; any IANA name works. */
const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function GuildSettingsForm({
  guildId,
  config,
  categories,
  textChannels,
  roles,
}: {
  guildId: string;
  config: Guild | null;
  categories: DiscordChannel[];
  textChannels: DiscordChannel[];
  roles: DiscordChannel[];
}) {
  const [ticketCategoryId, setTicketCategoryId] = useState(
    config?.ticketCategoryId ?? CHANNEL_NONE,
  );
  const [overflowCategoryIds, setOverflowCategoryIds] = useState<string[]>(
    config?.overflowCategoryIds ?? [],
  );
  const [autoCreateOverflow, setAutoCreateOverflow] = useState(
    config?.autoCreateOverflow ?? true,
  );
  const [transcriptChannelId, setTranscriptChannelId] = useState(
    config?.transcriptChannelId ?? CHANNEL_NONE,
  );
  const [dmTranscriptOnClose, setDmTranscriptOnClose] = useState(
    config?.dmTranscriptOnClose ?? false,
  );
  const [feedbackEnabled, setFeedbackEnabled] = useState(
    config?.feedbackEnabled ?? false,
  );
  const [logChannelId, setLogChannelId] = useState(
    config?.logChannelId ?? CHANNEL_NONE,
  );
  const [statusBoardChannelId, setStatusBoardChannelId] = useState(
    config?.statusBoardChannelId ?? CHANNEL_NONE,
  );
  const [onCallPingOnOpen, setOnCallPingOnOpen] = useState(
    config?.onCallPingOnOpen ?? true,
  );
  const [staffRoleIds, setStaffRoleIds] = useState<string[]>(
    config?.staffRoleIds ?? [],
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    config?.welcomeMessage ?? "",
  );
  const [ticketLimit, setTicketLimit] = useState(config?.ticketLimit ?? 1);
  const [supportTimezone, setSupportTimezone] = useState(
    config?.supportTimezone ?? "UTC",
  );
  const [supportHours, setSupportHours] = useState<SupportInterval[]>(
    config?.supportHours ?? [],
  );
  const [supportResponseHint, setSupportResponseHint] = useState(
    config?.supportResponseHint ?? "",
  );
  const [closeReasons, setCloseReasons] = useState<string[]>(
    config?.closeReasons ?? [],
  );
  const [namingScheme, setNamingScheme] = useState(
    config?.namingScheme ?? "ticket-{number}",
  );
  const [autoCloseHours, setAutoCloseHours] = useState(
    config?.autoCloseHours ?? 0,
  );
  const [autoCloseWarningHours, setAutoCloseWarningHours] = useState(
    config?.autoCloseWarningHours ?? 0,
  );
  const [autoCloseExcludeClaimed, setAutoCloseExcludeClaimed] = useState(
    config?.autoCloseExcludeClaimed ?? false,
  );
  const [autoCloseExcludeHighPriority, setAutoCloseExcludeHighPriority] =
    useState(config?.autoCloseExcludeHighPriority ?? false);

  const [pending, startTransition] = useTransition();

  const rolesUnavailable = roles.length === 0;

  function toggleRole(id: string, checked: boolean) {
    setStaffRoleIds((prev) =>
      checked ? [...prev, id] : prev.filter((r) => r !== id),
    );
  }

  function toggleOverflow(id: string, checked: boolean) {
    setOverflowCategoryIds((prev) =>
      checked ? [...prev, id] : prev.filter((c) => c !== id),
    );
  }

  // The primary category is always tried first, so exclude it from the manual
  // overflow list to avoid a confusing self-reference.
  const overflowCandidates = categories.filter(
    (c) => c.id !== ticketCategoryId,
  );

  const orNull = (v: string) => (v === CHANNEL_NONE ? null : v);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateGuildConfig({
          guildId,
          ticketCategoryId: orNull(ticketCategoryId),
          overflowCategoryIds: overflowCategoryIds.filter(
            (id) => id !== ticketCategoryId,
          ),
          autoCreateOverflow,
          transcriptChannelId: orNull(transcriptChannelId),
          dmTranscriptOnClose,
          feedbackEnabled,
          onCallPingOnOpen,
          logChannelId: orNull(logChannelId),
          statusBoardChannelId: orNull(statusBoardChannelId),
          staffRoleIds,
          welcomeMessage,
          ticketLimit,
          namingScheme,
          closeReasons: closeReasons.map((r) => r.trim()).filter(Boolean),
          supportTimezone: supportTimezone.trim() || "UTC",
          supportHours,
          supportResponseHint: supportResponseHint.trim() || null,
          autoCloseHours,
          autoCloseWarningHours,
          autoCloseExcludeClaimed,
          autoCloseExcludeHighPriority,
        });
        toast.success("Settings saved.");
      } catch {
        toast.error("Couldn't save settings. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Ticket category</Label>
        <ChannelSelect
          id="category"
          guildId={guildId}
          kind="category"
          channels={categories}
          value={ticketCategoryId}
          onValueChange={setTicketCategoryId}
          allowNone
          placeholder="— Select a category —"
        />
        <p className="text-xs text-muted-foreground">
          New ticket channels are created under this category.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Overflow categories</Label>
        <p className="text-xs text-muted-foreground">
          Discord caps a category at 50 channels. When the ticket category is
          full, new tickets fall back to the categories you pick here (in order),
          then to any auto-created overflow categories.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={autoCreateOverflow}
            onCheckedChange={(v) => setAutoCreateOverflow(v === true)}
          />
          <span>
            Auto-create a new overflow category when every category is full
            (recommended — tickets never fail to open)
          </span>
        </label>
        {overflowCandidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other categories available to use as manual fallbacks.
          </p>
        ) : (
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
            {overflowCandidates.map((cat) => {
              const checked = overflowCategoryIds.includes(cat.id);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleOverflow(cat.id, v === true)}
                  />
                  <span className="truncate">{cat.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="transcript">Transcript channel</Label>
          <ChannelSelect
            id="transcript"
            guildId={guildId}
            kind="text"
            channels={textChannels}
            categories={categories}
            value={transcriptChannelId}
            onValueChange={setTranscriptChannelId}
            allowNone
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={dmTranscriptOnClose}
              onCheckedChange={(v) => setDmTranscriptOnClose(v === true)}
            />
            <span>DM the transcript link to the opener when a ticket closes</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={feedbackEnabled}
              onCheckedChange={(v) => setFeedbackEnabled(v === true)}
            />
            <span>
              Ask the opener for a 1–5 star rating (DM) when a ticket closes
            </span>
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="log">Log channel</Label>
          <ChannelSelect
            id="log"
            guildId={guildId}
            kind="text"
            channels={textChannels}
            categories={categories}
            value={logChannelId}
            onValueChange={setLogChannelId}
            allowNone
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="status-board">Status board channel</Label>
          <ChannelSelect
            id="status-board"
            guildId={guildId}
            kind="text"
            channels={textChannels}
            categories={categories}
            value={statusBoardChannelId}
            onValueChange={setStatusBoardChannelId}
            allowNone
          />
          <p className="text-xs text-muted-foreground">
            The bot keeps one message here listing every open ticket, grouped by
            category. Make it read-only for members. See{" "}
            <strong>status board</strong> in the docs.
          </p>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <Checkbox
              checked={onCallPingOnOpen}
              onCheckedChange={(v) => setOnCallPingOnOpen(v === true)}
            />
            <span>Notify on-call staff when a ticket opens</span>
          </label>
          <p className="text-xs text-muted-foreground">
            DMs whoever is on call. Manage the roster on the{" "}
            <strong>On call</strong> page, or with <code>/oncall</code>.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Staff roles</Label>
        <p className="text-xs text-muted-foreground">
          These roles get access to every ticket channel.
        </p>
        {rolesUnavailable ? (
          <p className="text-sm text-muted-foreground">No roles available.</p>
        ) : (
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto rounded-lg border p-3 sm:grid-cols-2">
            {roles.map((role) => {
              const checked = staffRoleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleRole(role.id, v === true)}
                  />
                  <span className="truncate">{role.name}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="welcome">Welcome message</Label>
        <Textarea
          id="welcome"
          rows={3}
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          placeholder="Shown as the first message inside a new ticket."
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="limit">Ticket limit per user</Label>
          <Input
            id="limit"
            type="number"
            min={0}
            max={100}
            value={ticketLimit}
            onChange={(e) => setTicketLimit(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">0 = unlimited.</p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="naming">Channel naming scheme</Label>
          <Input
            id="naming"
            value={namingScheme}
            onChange={(e) => setNamingScheme(e.target.value)}
            placeholder="ticket-{number}"
          />
          <p className="text-xs text-muted-foreground">
            <code>{"{number}"}</code> and <code>{"{username}"}</code> are
            substituted.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Support hours</Label>
        <p className="text-xs text-muted-foreground">
          When a ticket opens outside these hours, the opener is told support may
          be slower and when it&apos;s next available. Leave empty to always be
          available.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="support-tz">Timezone</Label>
            <Input
              id="support-tz"
              list="tz-options"
              value={supportTimezone}
              maxLength={64}
              placeholder="UTC"
              onChange={(e) => setSupportTimezone(e.target.value)}
            />
            <datalist id="tz-options">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="text-xs text-muted-foreground">
              An IANA name like <code>Europe/London</code>. Hours follow daylight
              saving automatically.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="support-hint">Expected response time</Label>
            <Input
              id="support-hint"
              value={supportResponseHint}
              maxLength={200}
              placeholder="e.g. usually within 2 hours"
              onChange={(e) => setSupportResponseHint(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown on every new ticket, in and out of hours. Optional.
            </p>
          </div>
        </div>

        {supportHours.length > 0 &&
          supportHours.map((interval, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select
                items={DAY_ITEMS}
                value={String(interval.day)}
                onValueChange={(v) =>
                  setSupportHours((p) =>
                    p.map((x, idx) =>
                      idx === i ? { ...x, day: Number(v as string) } : x,
                    ),
                  )
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DAY_ITEMS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                className="w-32"
                value={interval.start}
                onChange={(e) =>
                  setSupportHours((p) =>
                    p.map((x, idx) =>
                      idx === i ? { ...x, start: e.target.value } : x,
                    ),
                  )
                }
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="time"
                className="w-32"
                value={interval.end}
                onChange={(e) =>
                  setSupportHours((p) =>
                    p.map((x, idx) =>
                      idx === i ? { ...x, end: e.target.value } : x,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove support hours"
                onClick={() =>
                  setSupportHours((p) => p.filter((_, idx) => idx !== i))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSupportHours((p) => [
                ...p,
                { day: 1, start: "09:00", end: "17:00" },
              ])
            }
          >
            <Plus className="size-4" />
            Add hours
          </Button>
          {supportHours.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSupportHours(WEEKDAYS_9_TO_5)}
            >
              Use Mon–Fri, 9–5
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          A span must end after it starts. For an overnight shift, add two — one
          ending at 23:59 and one starting at 00:00 the next day.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Close reasons</Label>
        <p className="text-xs text-muted-foreground">
          Suggested when staff close a ticket — offered by <code>/close</code>{" "}
          and <code>/closerequest</code>, and in the close-with-reason dropdown.
          Staff can always type something else. Reasons your staff use often are
          suggested automatically, even if they&apos;re not listed here.
        </p>
        {closeReasons.map((reason, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={reason}
              maxLength={100}
              placeholder="e.g. Resolved — no further action needed"
              onChange={(e) =>
                setCloseReasons((p) =>
                  p.map((r, idx) => (idx === i ? e.target.value : r)),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove close reason"
              onClick={() =>
                setCloseReasons((p) => p.filter((_, idx) => idx !== i))
              }
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={closeReasons.length >= MAX_CLOSE_REASONS}
          onClick={() => setCloseReasons((p) => [...p, ""])}
        >
          <Plus className="size-4" />
          Add reason
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Auto-close on inactivity</Label>
        <p className="text-xs text-muted-foreground">
          Automatically close tickets that go quiet. A human reply resets the
          clock; bot messages don&apos;t count.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="auto-close-hours">Close after (hours)</Label>
            <Input
              id="auto-close-hours"
              type="number"
              min={0}
              max={8760}
              value={autoCloseHours}
              onChange={(e) => setAutoCloseHours(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Hours of inactivity before closing. 0 = off.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="auto-close-warning">Warn before (hours)</Label>
            <Input
              id="auto-close-warning"
              type="number"
              min={0}
              max={8760}
              value={autoCloseWarningHours}
              onChange={(e) => setAutoCloseWarningHours(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Post a heads-up this many hours before closing (must be less than
              the close time). 0 = no warning.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={autoCloseExcludeClaimed}
            onCheckedChange={(v) => setAutoCloseExcludeClaimed(v === true)}
          />
          <span>Never auto-close claimed tickets</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={autoCloseExcludeHighPriority}
            onCheckedChange={(v) => setAutoCloseExcludeHighPriority(v === true)}
          />
          <span>Never auto-close high or urgent tickets</span>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
