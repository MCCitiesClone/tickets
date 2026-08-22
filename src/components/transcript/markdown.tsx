import { Fragment, type ReactNode } from "react";

import type { TranscriptMention } from "@/db/schema";

type MentionMap = Map<string, TranscriptMention>;

/** Inline formatting rules, tried earliest-match-wins (order breaks ties). */
type InlineRule = {
  regex: RegExp;
  render: (
    m: RegExpExecArray,
    mentions: MentionMap,
    key: string,
    rules: InlineRule[],
  ) => ReactNode;
};

const CDN_EMOJI = "https://cdn.discordapp.com/emojis";

// Inline code — no nested formatting inside.
const CODE_RULE: InlineRule = {
  regex: /`([^`]+)`/,
  render: (m, _mn, key) => (
    <code
      key={key}
      className="rounded bg-black/40 px-1 py-0.5 font-mono text-[0.85em]"
    >
      {m[1]}
    </code>
  ),
};

// Custom emoji <:name:id> / <a:name:id>. Discord renders these everywhere it
// renders text — including embed titles and field names.
const EMOJI_RULE: InlineRule = {
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
};

// Mentions <@id> <@!id> <@&id> <#id>
const MENTION_RULE: InlineRule = {
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
};

// Spoiler ||text||
const SPOILER_RULE: InlineRule = {
  regex: /\|\|([\s\S]+?)\|\|/,
  render: (m, mn, key, rules) => (
    <span
      key={key}
      className="rounded bg-black/60 px-1 text-white/0 transition-colors hover:text-white/90"
    >
      {renderInline(m[1], mn, key, rules)}
    </span>
  ),
};

// [text](url)
const MASKED_LINK_RULE: InlineRule = {
  regex: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
  render: (m, mn, key, rules) => (
    <a
      key={key}
      href={m[2]}
      target="_blank"
      rel="noreferrer noopener"
      className="text-sky-400 hover:underline"
    >
      {renderInline(m[1], mn, key, rules)}
    </a>
  ),
};

// Bare URL
const BARE_URL_RULE: InlineRule = {
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
};

/**
 * Emphasis content that neither starts nor ends with whitespace — either two or
 * more characters, or a single one. Discord requires this for single-marker
 * italics, so `2 * 3 * 4` stays arithmetic instead of turning into `2 3 4`.
 * Written without lookbehind to keep older Safari happy.
 */
const TIGHT = "([^\\s][\\s\\S]*?[^\\s]|[^\\s])";

const STYLE_RULES: InlineRule[] = [
  { regex: /\*\*([\s\S]+?)\*\*/, render: strong },
  { regex: /__([\s\S]+?)__/, render: underline },
  { regex: /~~([\s\S]+?)~~/, render: strike },
  { regex: new RegExp(`\\*${TIGHT}\\*`), render: em },
  { regex: new RegExp(`_${TIGHT}_`), render: em },
];

/**
 * Full inline rule set — for embed descriptions, field values, and message
 * content, where Discord renders masked/bare links in addition to text styles.
 */
const INLINE_RULES: InlineRule[] = [
  CODE_RULE,
  EMOJI_RULE,
  MENTION_RULE,
  SPOILER_RULE,
  MASKED_LINK_RULE,
  ...STYLE_RULES,
  BARE_URL_RULE,
];

/**
 * Inline rules without links — for embed titles and field names, where Discord
 * renders text styles and emoji but shows masked/bare links as raw text.
 */
const INLINE_RULES_NO_LINKS: InlineRule[] = [
  CODE_RULE,
  EMOJI_RULE,
  MENTION_RULE,
  SPOILER_RULE,
  ...STYLE_RULES,
];

function strong(
  m: RegExpExecArray,
  mn: MentionMap,
  key: string,
  rules: InlineRule[],
): ReactNode {
  return <strong key={key}>{renderInline(m[1], mn, key, rules)}</strong>;
}
function underline(
  m: RegExpExecArray,
  mn: MentionMap,
  key: string,
  rules: InlineRule[],
): ReactNode {
  return <u key={key}>{renderInline(m[1], mn, key, rules)}</u>;
}
function strike(
  m: RegExpExecArray,
  mn: MentionMap,
  key: string,
  rules: InlineRule[],
): ReactNode {
  return <s key={key}>{renderInline(m[1], mn, key, rules)}</s>;
}
function em(
  m: RegExpExecArray,
  mn: MentionMap,
  key: string,
  rules: InlineRule[],
): ReactNode {
  return <em key={key}>{renderInline(m[1], mn, key, rules)}</em>;
}

/** Recursively render inline markdown into React nodes. */
function renderInline(
  text: string,
  mentions: MentionMap,
  keyPrefix: string,
  rules: InlineRule[] = INLINE_RULES,
): ReactNode {
  if (!text) return null;

  // Find the earliest-starting match across all rules.
  let best: { rule: InlineRule; match: RegExpExecArray } | null = null;
  for (const rule of rules) {
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
      {rule.render(match, mentions, key, rules)}
      {renderInline(after, mentions, `${key}b`, rules)}
    </Fragment>
  );
}

/** Zero-width space, so an empty line still occupies a row. */
const ZWSP = "​";

/**
 * Render one line of block-level Discord markdown: headings (`#`/`##`/`###`),
 * subtext (`-#`), blockquotes (`>`), and unordered/ordered lists. Anything else
 * is a plain paragraph line. Inline formatting is applied within each.
 */
function renderBlockLine(
  line: string,
  mentions: MentionMap,
  key: string,
): ReactNode {
  const inline = (text: string) => renderInline(text, mentions, key) || ZWSP;

  if (line.startsWith("> ")) {
    return (
      <div
        key={key}
        className="border-l-2 border-white/20 pl-3 text-white/80"
      >
        {inline(line.slice(2))}
      </div>
    );
  }

  // Subtext `-# ` — checked before list items so it isn't read as a bullet.
  if (line.startsWith("-# ")) {
    return (
      <div key={key} className="text-xs text-white/50">
        {inline(line.slice(3))}
      </div>
    );
  }

  const heading = /^(#{1,3}) +(.*)$/.exec(line);
  if (heading) {
    const level = heading[1].length;
    const size =
      level === 1 ? "text-xl" : level === 2 ? "text-lg" : "text-base";
    return (
      <div key={key} className={`${size} mt-1 font-bold text-white`}>
        {inline(heading[2])}
      </div>
    );
  }

  const unordered = /^(\s*)[-*] +(.*)$/.exec(line);
  if (unordered) {
    const depth = Math.floor(unordered[1].length / 2);
    return (
      <div
        key={key}
        className="flex gap-2"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <span className="text-white/60">•</span>
        <span>{inline(unordered[2])}</span>
      </div>
    );
  }

  const ordered = /^(\s*)(\d+)\. +(.*)$/.exec(line);
  if (ordered) {
    const depth = Math.floor(ordered[1].length / 2);
    return (
      <div
        key={key}
        className="flex gap-2"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
      >
        <span className="text-white/60">{ordered[2]}.</span>
        <span>{inline(ordered[3])}</span>
      </div>
    );
  }

  return <div key={key}>{inline(line)}</div>;
}

/**
 * Render a single line of Discord-flavored inline markdown (text styles, code,
 * custom emoji, mentions) without the block-level wrapper `MarkdownContent`
 * adds. Used for embed titles and field names — where Discord renders emoji and
 * text styles but not masked links, so `links` defaults to false.
 */
export function InlineMarkdown({
  content,
  mentions = [],
  links = false,
}: {
  content: string;
  mentions?: TranscriptMention[];
  links?: boolean;
}) {
  if (!content) return null;
  const map: MentionMap = new Map(mentions.map((m) => [m.id, m]));
  return (
    <>{renderInline(content, map, "inline", links ? INLINE_RULES : INLINE_RULES_NO_LINKS)}</>
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
            {segment
              .split("\n")
              .map((line, j) => renderBlockLine(line, map, `${i}-${j}`))}
          </Fragment>
        );
      })}
    </div>
  );
}
