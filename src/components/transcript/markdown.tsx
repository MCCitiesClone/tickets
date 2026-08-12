import { Fragment, type ReactNode } from "react";

import type { TranscriptMention } from "@/db/schema";

type MentionMap = Map<string, TranscriptMention>;

/** Inline formatting rules, tried earliest-match-wins (order breaks ties). */
type InlineRule = {
  regex: RegExp;
  render: (m: RegExpExecArray, mentions: MentionMap, key: string) => ReactNode;
};

const CDN_EMOJI = "https://cdn.discordapp.com/emojis";

const INLINE_RULES: InlineRule[] = [
  // Inline code — no nested formatting inside.
  {
    regex: /`([^`]+)`/,
    render: (m, _mn, key) => (
      <code
        key={key}
        className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em]"
      >
        {m[1]}
      </code>
    ),
  },
  // Custom emoji <:name:id> / <a:name:id>
  {
    regex: /<(a)?:(\w+):(\d+)>/,
    render: (m, _mn, key) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={key}
        src={`${CDN_EMOJI}/${m[3]}.${m[1] ? "gif" : "png"}?size=32`}
        alt={`:${m[2]}:`}
        title={`:${m[2]}:`}
        className="inline-block h-[1.25em] w-[1.25em] align-[-0.2em]"
      />
    ),
  },
  // Mentions <@id> <@!id> <@&id> <#id>
  {
    regex: /<(@!?|@&|#)(\d+)>/,
    render: (m, mentions, key) => {
      const sigil = m[1];
      const id = m[2];
      const mention = mentions.get(id);
      const prefix = sigil === "#" ? "#" : "@";
      const label = mention?.name ?? id;
      return (
        <span
          key={key}
          className="rounded bg-indigo-500/25 px-1 font-medium text-indigo-200"
        >
          {prefix}
          {label}
        </span>
      );
    },
  },
  // [text](url)
  {
    regex: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
    render: (m, mn, key) => (
      <a
        key={key}
        href={m[2]}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sky-400 hover:underline"
      >
        {renderInline(m[1], mn, key)}
      </a>
    ),
  },
  { regex: /\*\*([\s\S]+?)\*\*/, render: strong },
  { regex: /__([\s\S]+?)__/, render: underline },
  { regex: /~~([\s\S]+?)~~/, render: strike },
  { regex: /\*([\s\S]+?)\*/, render: em },
  { regex: /_([\s\S]+?)_/, render: em },
  // Bare URL
  {
    regex: /(https?:\/\/[^\s<]+)/,
    render: (m, _mn, key) => (
      <a
        key={key}
        href={m[1]}
        target="_blank"
        rel="noreferrer noopener"
        className="text-sky-400 hover:underline"
      >
        {m[1]}
      </a>
    ),
  },
];

function strong(m: RegExpExecArray, mn: MentionMap, key: string): ReactNode {
  return <strong key={key}>{renderInline(m[1], mn, key)}</strong>;
}
function underline(m: RegExpExecArray, mn: MentionMap, key: string): ReactNode {
  return <u key={key}>{renderInline(m[1], mn, key)}</u>;
}
function strike(m: RegExpExecArray, mn: MentionMap, key: string): ReactNode {
  return <s key={key}>{renderInline(m[1], mn, key)}</s>;
}
function em(m: RegExpExecArray, mn: MentionMap, key: string): ReactNode {
  return <em key={key}>{renderInline(m[1], mn, key)}</em>;
}

/** Recursively render inline markdown into React nodes. */
function renderInline(
  text: string,
  mentions: MentionMap,
  keyPrefix: string,
): ReactNode {
  if (!text) return null;

  // Find the earliest-starting match across all rules.
  let best: { rule: InlineRule; match: RegExpExecArray } | null = null;
  for (const rule of INLINE_RULES) {
    const match = rule.regex.exec(text);
    if (match && (!best || match.index < best.match.index)) {
      best = { rule, match };
    }
  }

  if (!best) return text;

  const { rule, match } = best;
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + match[0].length);
  const key = `${keyPrefix}-${match.index}`;

  return (
    <Fragment key={keyPrefix}>
      {before}
      {rule.render(match, mentions, key)}
      {renderInline(after, mentions, `${key}b`)}
    </Fragment>
  );
}

/**
 * Render a Discord-flavored markdown string: fenced/inline code, bold, italic,
 * underline, strikethrough, links, blockquotes, mentions, and custom emoji.
 * A focused subset — enough to reproduce a ticket conversation faithfully.
 */
export function MarkdownContent({
  content,
  mentions = [],
}: {
  content: string;
  mentions?: TranscriptMention[];
}) {
  if (!content) return null;
  const map: MentionMap = new Map(mentions.map((m) => [m.id, m]));

  // Split out fenced code blocks; capturing group keeps the code contents.
  const segments = content.split(/```(?:[a-zA-Z0-9+#-]+)?\n?([\s\S]*?)```/);

  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed">
      {segments.map((segment, i) => {
        if (i % 2 === 1) {
          return (
            <pre
              key={i}
              className="my-1 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[0.85em]"
            >
              <code>{segment}</code>
            </pre>
          );
        }
        return (
          <Fragment key={i}>
            {segment.split("\n").map((line, j) => {
              const quote = line.startsWith("> ");
              const body = quote ? line.slice(2) : line;
              return (
                <div
                  key={j}
                  className={
                    quote
                      ? "border-l-2 border-white/20 pl-3 text-white/80"
                      : undefined
                  }
                >
                  {renderInline(body, map, `${i}-${j}`) || "​"}
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </div>
  );
}
