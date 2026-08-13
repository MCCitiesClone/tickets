"use client";

import { useEffect, useState } from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DiscordEmoji } from "@/components/discord-emoji";

type GuildEmoji = { id: string; name: string; animated: boolean };

const mention = (e: GuildEmoji) =>
  `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`;

/**
 * Emoji field for panel buttons: a text input (paste a unicode emoji) plus a
 * picker of the server's custom emojis. Picking a custom emoji stores it in
 * Discord's `<:name:id>` mention form, which is what the bot needs to render it
 * on buttons and in dropdown options.
 */
export function EmojiPicker({
  guildId,
  value,
  onChange,
  disabled,
}: {
  guildId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="📩 or pick a server emoji →"
          disabled={disabled}
          className="pr-8"
        />
        {value && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
            <DiscordEmoji emoji={value} className="inline-block size-4" />
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label="Pick a server emoji"
            >
              <Smile className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="max-h-64 w-52 overflow-y-auto">
          {value && (
            <DropdownMenuItem onClick={() => onChange("")}>
              Clear emoji
            </DropdownMenuItem>
          )}
          {emojis.length === 0 ? (
            <DropdownMenuItem disabled>
              No custom emojis on this server
            </DropdownMenuItem>
          ) : (
            emojis.map((e) => (
              <DropdownMenuItem key={e.id} onClick={() => onChange(mention(e))}>
                <DiscordEmoji
                  emoji={mention(e)}
                  className="inline-block size-4"
                />
                <span className="truncate">{e.name}</span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
