import { Fragment } from "react";

/** `<@id>` / `<@!id>` / `<@&id>` / `<#id>` — the mention forms the bot writes. */
const MENTION = /<(@[!&]?|#)(\d{17,20})>/g;

export type MentionNames = {
  users?: Record<string, string>;
  roles?: Record<string, string>;
  channels?: Record<string, string>;
};

/**
 * Render text containing Discord mentions with readable names.
 *
 * Audit summaries are stored exactly as they're posted to the log channel, so
 * they carry raw `<@id>` markup. Discord resolves those for you; a web page has
 * to do it itself. An ID we can't resolve falls back to its own snowflake, which
 * still identifies the subject rather than showing broken markup.
 */
export function DiscordMentions({
  text,
  names = {},
  className,
}: {
  text: string;
  names?: MentionNames;
  className?: string;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(MENTION)) {
    const [raw, kind, id] = match;
    const at = match.index;
    if (at > last) parts.push(text.slice(last, at));

    const label =
      kind === "#"
        ? `#${names.channels?.[id] ?? id}`
        : kind === "@&"
          ? `@${names.roles?.[id] ?? id}`
          : `@${names.users?.[id] ?? id}`;

    parts.push(
      <span
        key={`${at}-${id}`}
        className="rounded bg-primary/10 px-1 font-medium text-primary"
        title={id}
      >
        {label}
      </span>,
    );
    last = at + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <span className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </span>
  );
}

/** Every distinct mention ID in a batch of text, grouped by kind. */
export function collectMentionIds(texts: string[]): {
  users: string[];
  roles: string[];
  channels: string[];
} {
  const users = new Set<string>();
  const roles = new Set<string>();
  const channels = new Set<string>();

  for (const text of texts) {
    for (const [, kind, id] of text.matchAll(MENTION)) {
      if (kind === "#") channels.add(id);
      else if (kind === "@&") roles.add(id);
      else users.add(id);
    }
  }
  return {
    users: [...users],
    roles: [...roles],
    channels: [...channels],
  };
}
