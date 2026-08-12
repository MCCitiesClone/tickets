/**
 * A "message template" is a full Discord message payload (optional content plus
 * up to 10 embeds) that admins design in the dashboard embed editor. Templates
 * are stored as JSON and rendered by the bot at send time, with `{placeholder}`
 * tokens substituted for live values (ticket number, opener, reason, …).
 *
 * `TemplateEmbed` deliberately mirrors `TranscriptEmbed` (see
 * `./tickets.ts`) so the transcript viewer's `Embed`/`MarkdownContent`
 * components can be reused, unchanged, for the editor's live preview.
 */

export type EmbedField = { name: string; value: string; inline?: boolean };

export type TemplateEmbed = {
  author?: { name: string; iconUrl?: string; url?: string };
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string; iconUrl?: string };
  /** ISO timestamp to show in the embed footer, if any. */
  timestamp?: string;
};

export type MessageTemplate = {
  content?: string;
  embeds: TemplateEmbed[];
};

/** The admin-configurable system messages, keyed by purpose. */
export type GuildMessageTemplates = {
  /** First message posted inside a newly opened ticket. */
  welcome?: MessageTemplate;
  /** Posted in the ticket channel when a staff member claims it. */
  claimNotice?: MessageTemplate;
  /** DMed to the opener when their ticket closes (if enabled). */
  closeDm?: MessageTemplate;
  /** Posted to the transcript channel when a ticket closes. */
  transcriptPost?: MessageTemplate;
};

/** Keys of the configurable guild-level system messages. */
export type MessageTemplateKey = keyof GuildMessageTemplates;

/** True when a template would actually render something. */
export function isTemplateEmpty(t: MessageTemplate | null | undefined): boolean {
  if (!t) return true;
  const hasContent = Boolean(t.content && t.content.trim());
  const hasEmbed = t.embeds.some(
    (e) =>
      e.title ||
      e.description ||
      e.author?.name ||
      e.footer?.text ||
      e.image?.url ||
      e.thumbnail?.url ||
      (e.fields && e.fields.length > 0),
  );
  return !hasContent && !hasEmbed;
}
