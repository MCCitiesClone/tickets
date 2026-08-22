"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as nodeEmoji from "node-emoji";

import { DiscordEmoji } from "@/components/discord-emoji";
import { replaceRange } from "@/components/message-editor/editor-utils";
import { cn } from "@/lib/utils";

type GuildEmoji = { id: string; name: string; animated: boolean };

type Suggestion = {
  key: string;
  /** Shortcode shown in the list, without colons. */
  name: string;
  /** Text written into the field when chosen. */
  insert: string;
};

/** How many suggestions the menu shows at once. */
const MAX_SUGGESTIONS = 12;

/**
 * A `:token` sitting immediately before the caret, at a word boundary. Requires
 * two characters after the colon so a bare `:` (or a time like `12:3`) doesn't
 * open the menu, and refuses to match after `<`, which is someone hand-writing
 * a `<:name:id>` mention.
 */
const TOKEN = /(?:^|[\s([{,])(:([a-z0-9_+-]{2,}))$/i;

const emojiMention = (e: GuildEmoji) =>
  `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`;

/**
 * The `:token` immediately before the caret, given the text up to it. Returns
 * the token's start offset and the query after the colon, or null when the
 * caret isn't in one. Exported for tests — the DOM wiring around it isn't
 * interesting, this is.
 */
export function matchEmojiToken(
  beforeCaret: string,
): { start: number; query: string } | null {
  const match = TOKEN.exec(beforeCaret);
  if (!match) return null;
  return {
    start: beforeCaret.length - match[1].length,
    query: match[2],
  };
}

/**
 * Suggestions for a query: the server's custom emojis first — exact, then
 * prefix, then substring matches — followed by unicode emoji. A server's own
 * emoji is almost always what someone typing `:` in this dashboard wants.
 */
export function buildSuggestions(
  query: string,
  emojis: GuildEmoji[],
): Suggestion[] {
  const q = query.toLowerCase();

  const custom = emojis
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const rank = (n: string) =>
        n.toLowerCase() === q ? 0 : n.toLowerCase().startsWith(q) ? 1 : 2;
      return rank(a.name) - rank(b.name) || a.name.localeCompare(b.name);
    })
    .map((e) => ({
      key: `custom:${e.id}`,
      name: e.name,
      insert: emojiMention(e),
    }));

  const unicode = nodeEmoji.search(q).map((r) => ({
    key: `unicode:${r.name}`,
    name: r.name,
    insert: r.emoji,
  }));

  return [...custom, ...unicode].slice(0, MAX_SUGGESTIONS);
}

type Anchor = {
  el: HTMLInputElement | HTMLTextAreaElement;
  /** Index of the `:` that opened the menu. */
  start: number;
  /** Caret position — end of the token being replaced. */
  end: number;
  query: string;
  /** Menu position, relative to the wrapper. */
  top: number;
  left: number;
  width: number;
};

function isTextField(t: EventTarget | null): t is HTMLInputElement | HTMLTextAreaElement {
  if (t instanceof HTMLTextAreaElement) return true;
  return (
    t instanceof HTMLInputElement &&
    ["text", "search", "url", ""].includes(t.type)
  );
}

/**
 * Discord-style `:shortcode` emoji autocomplete for every text field inside it.
 *
 * Rather than each field opting in, this listens on the wrapper during the
 * capture phase and works out which field the caret is in — so a form can gain
 * the behaviour on every input and textarea it renders, present and future, by
 * being wrapped once.
 *
 * Suggestions are the server's custom emojis (inserted as `<:name:id>`, the form
 * the bot needs) followed by unicode emoji (inserted as the glyph). Without a
 * `guildId` only unicode is offered.
 */
export function EmojiAutocomplete({
  guildId,
  className,
  children,
}: {
  guildId?: string;
  className?: string;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!guildId) return;
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

  const suggestions = useMemo<Suggestion[]>(
    () => (anchor ? buildSuggestions(anchor.query, emojis) : []),
    [anchor, emojis],
  );

  const close = useCallback(() => setAnchor(null), []);

  /** Re-evaluate the token before the caret of whichever field fired. */
  const detect = useCallback((target: EventTarget | null) => {
    if (!isTextField(target)) return close();
    const el = target;
    const caret = el.selectionStart;
    if (caret == null || caret !== el.selectionEnd) return close();

    const token = matchEmojiToken(el.value.slice(0, caret));
    if (!token) return close();

    const root = rootRef.current;
    if (!root) return close();
    const fieldBox = el.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();

    setActive(0);
    setAnchor({
      el,
      start: token.start,
      end: caret,
      query: token.query,
      top: fieldBox.bottom - rootBox.top + 4,
      left: fieldBox.left - rootBox.left,
      width: fieldBox.width,
    });
  }, [close]);

  const choose = useCallback(
    (suggestion: Suggestion) => {
      if (!anchor) return;
      replaceRange(anchor.el, anchor.start, anchor.end, suggestion.insert);
      close();
    },
    [anchor, close],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!anchor || suggestions.length === 0) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        // Enter would submit the surrounding form; Tab would leave the field.
        e.preventDefault();
        choose(suggestions[active]);
      }
    },
    [anchor, suggestions, active, choose, close],
  );

  const open = anchor !== null && suggestions.length > 0;

  return (
    <div
      ref={rootRef}
      className={cn("relative", className)}
      onInputCapture={(e) => detect(e.target)}
      onKeyDownCapture={onKeyDown}
      // Arrow keys, Home/End and clicks move the caret without an input event.
      onKeyUpCapture={(e) => {
        if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
          detect(e.target);
        }
      }}
      onClickCapture={(e) => {
        if (isTextField(e.target)) detect(e.target);
      }}
      onBlurCapture={close}
    >
      {children}

      {open && (
        <div
          role="listbox"
          aria-label="Emoji suggestions"
          className="absolute z-50 max-h-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          style={{
            top: anchor.top,
            left: anchor.left,
            width: Math.max(200, Math.min(anchor.width, 320)),
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="option"
              aria-selected={i === active}
              // Keep focus in the field so blur never closes us mid-click.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(s)}
              className={cn(
                "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm",
                i === active && "bg-accent text-accent-foreground",
              )}
            >
              <DiscordEmoji emoji={s.insert} className="inline-block size-4" />
              <span className="truncate">:{s.name}:</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
