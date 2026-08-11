"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import type { Guild } from "@/db/schema";
import type { DiscordChannel } from "@/lib/discord-api";
import { updateGuildConfig } from "@/app/actions/guild";

// Sentinel for "no channel selected" (base-ui Select needs a concrete value).
const NONE = "none";

/**
 * Build the value→label map for a channel Select. Passed as `items` to the
 * Select root (base-ui uses it to show the label, not the id, in the trigger)
 * and also drives the option list so labels aren't duplicated.
 */
function channelItems(
  channels: DiscordChannel[],
  noneLabel: string,
): Record<string, string> {
  return {
    [NONE]: noneLabel,
    ...Object.fromEntries(channels.map((c) => [c.id, c.name])),
  };
}

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
    config?.ticketCategoryId ?? NONE,
  );
  const [transcriptChannelId, setTranscriptChannelId] = useState(
    config?.transcriptChannelId ?? NONE,
  );
  const [logChannelId, setLogChannelId] = useState(
    config?.logChannelId ?? NONE,
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

  const discordUnavailable =
    categories.length === 0 && textChannels.length === 0 && roles.length === 0;

  const categoryItems = channelItems(categories, "— Select a category —");
  const textItems = channelItems(textChannels, "— None —");

  function toggleRole(id: string, checked: boolean) {
    setStaffRoleIds((prev) =>
      checked ? [...prev, id] : prev.filter((r) => r !== id),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateGuildConfig({
          guildId,
          ticketCategoryId: ticketCategoryId === NONE ? null : ticketCategoryId,
          transcriptChannelId:
            transcriptChannelId === NONE ? null : transcriptChannelId,
          logChannelId: logChannelId === NONE ? null : logChannelId,
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
      {discordUnavailable && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
          Couldn&apos;t load this server&apos;s channels and roles from Discord.
          You can still save, but the dropdowns are empty — check that the bot is
          in the server and <code>DISCORD_TOKEN</code> is valid.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Ticket category</Label>
        <Select
          items={categoryItems}
          value={ticketCategoryId}
          onValueChange={(v) => setTicketCategoryId(v as string)}
        >
          <SelectTrigger id="category" className="w-full">
            <SelectValue placeholder="— Select a category —" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(categoryItems).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          New ticket channels are created under this category.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="transcript">Transcript channel</Label>
          <Select
            items={textItems}
            value={transcriptChannelId}
            onValueChange={(v) => setTranscriptChannelId(v as string)}
          >
            <SelectTrigger id="transcript" className="w-full">
              <SelectValue placeholder="— None —" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(textItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="log">Log channel</Label>
          <Select
            items={textItems}
            value={logChannelId}
            onValueChange={(v) => setLogChannelId(v as string)}
          >
            <SelectTrigger id="log" className="w-full">
              <SelectValue placeholder="— None —" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(textItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Staff roles</Label>
        <p className="text-xs text-muted-foreground">
          These roles get access to every ticket channel.
        </p>
        {roles.length === 0 ? (
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
