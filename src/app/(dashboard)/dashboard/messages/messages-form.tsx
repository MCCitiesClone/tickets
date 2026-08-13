"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MessageTemplateEditor } from "@/components/message-editor/message-template-editor";
import { presetsFor } from "@/components/message-editor/presets";
import type {
  GuildMessageTemplates,
  MessageTemplate,
  MessageTemplateKey,
} from "@/db/schema";
import { updateGuildConfig } from "@/app/actions/guild";

const TABS: {
  key: MessageTemplateKey;
  label: string;
  hint: string;
  placeholders: string[];
}[] = [
  {
    key: "welcome",
    label: "Welcome",
    hint: "Posted inside a ticket when it opens. Form answers are appended as fields.",
    placeholders: ["ticket", "username", "user", "server", "channel"],
  },
  {
    key: "claimNotice",
    label: "Claim notice",
    hint: "Posted in the ticket when a staff member claims it.",
    placeholders: ["claimer", "ticket", "server", "channel"],
  },
  {
    key: "closeDm",
    label: "Close DM",
    hint: "DMed to the opener when their ticket closes (if DM-on-close is enabled).",
    placeholders: ["ticket", "server", "reason", "transcript_url"],
  },
  {
    key: "transcriptPost",
    label: "Transcript post",
    hint: "Posted to the transcript channel when a ticket closes.",
    placeholders: ["ticket", "opener", "closer", "reason", "transcript_url"],
  },
];

const EMPTY: MessageTemplate = { embeds: [] };

export function MessagesForm({
  guildId,
  initial,
}: {
  guildId: string;
  initial: GuildMessageTemplates;
}) {
  const [templates, setTemplates] = useState<GuildMessageTemplates>(initial);
  const [tab, setTab] = useState<MessageTemplateKey>("welcome");
  const [pending, startTransition] = useTransition();

  const active = TABS.find((t) => t.key === tab)!;
  const value = templates[tab] ?? EMPTY;

  const setValue = (next: MessageTemplate) =>
    setTemplates((prev) => ({ ...prev, [tab]: next }));

  function save() {
    startTransition(async () => {
      try {
        await updateGuildConfig({ guildId, messageTemplates: templates });
        toast.success("Messages saved.");
      } catch {
        toast.error("Couldn't save. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            type="button"
            variant={t.key === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {active.hint} Leave empty to use the built-in default message.
      </p>

      <MessageTemplateEditor
        key={tab}
        value={value}
        onChange={setValue}
        placeholders={active.placeholders}
        presets={presetsFor(tab)}
        guildId={guildId}
      />

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save messages"}
        </Button>
      </div>
    </div>
  );
}
