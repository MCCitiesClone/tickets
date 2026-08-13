"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelect, CHANNEL_NONE } from "@/components/channel-select";
import type { Guild } from "@/db/schema";
import type { DiscordChannel } from "@/lib/discord-api";
import { updateGuildConfig } from "@/app/actions/guild";

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
  const [staffRoleIds, setStaffRoleIds] = useState<string[]>(
    config?.staffRoleIds ?? [],
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    config?.welcomeMessage ?? "",
  );
  const [ticketLimit, setTicketLimit] = useState(config?.ticketLimit ?? 1);
  const [namingScheme, setNamingScheme] = useState(
    config?.namingScheme ?? "ticket-{number}",
  );

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
          logChannelId: orNull(logChannelId),
          staffRoleIds,
          welcomeMessage,
          ticketLimit,
          namingScheme,
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
