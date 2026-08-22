import { EmbedBuilder } from "discord.js";

import type { MessageTemplate, TemplateEmbed } from "@/db/schema";
import { applyPlaceholders } from "@/lib/placeholders";

export { applyPlaceholders };

/** Substitute placeholders and drop the value if it ends up empty. */
function sub(
  value: string | undefined,
  vars: Record<string, string>,
): string | undefined {
  const out = applyPlaceholders(value, vars);
  return out && out.length > 0 ? out : undefined;
}

/** Build a discord.js embed from a template embed, or null if it's empty. */
function buildEmbed(
  e: TemplateEmbed,
  vars: Record<string, string>,
): EmbedBuilder | null {
  const eb = new EmbedBuilder();
  let has = false;

  const title = sub(e.title, vars);
  if (title) {
    eb.setTitle(title.slice(0, 256));
    has = true;
  }
  const description = sub(e.description, vars);
  if (description) {
    eb.setDescription(description.slice(0, 4096));
    has = true;
  }
  const url = sub(e.url, vars);
  if (url) eb.setURL(url);
  if (e.color != null) eb.setColor(e.color);

  const authorName = sub(e.author?.name, vars);
  if (authorName) {
    eb.setAuthor({
      name: authorName.slice(0, 256),
      iconURL: sub(e.author?.iconUrl, vars),
      url: sub(e.author?.url, vars),
    });
    has = true;
  }

  if (e.fields?.length) {
    const fields = e.fields.slice(0, 25).map((f) => ({
      name: (sub(f.name, vars) ?? "​").slice(0, 256),
      value: (sub(f.value, vars) ?? "​").slice(0, 1024),
      inline: f.inline ?? false,
    }));
    eb.addFields(fields);
    has = true;
  }

  const imageUrl = sub(e.image?.url, vars);
  if (imageUrl) {
    eb.setImage(imageUrl);
    has = true;
  }
  const thumbnailUrl = sub(e.thumbnail?.url, vars);
  if (thumbnailUrl) {
    eb.setThumbnail(thumbnailUrl);
    has = true;
  }

  const footerText = sub(e.footer?.text, vars);
  if (footerText) {
    eb.setFooter({
      text: footerText.slice(0, 2048),
      iconURL: sub(e.footer?.iconUrl, vars),
    });
    has = true;
  }

  if (e.timestamp) {
    const date = new Date(e.timestamp);
    if (!Number.isNaN(date.getTime())) eb.setTimestamp(date);
  }

  return has ? eb : null;
}

export type RenderedMessage = { content?: string; embeds: EmbedBuilder[] };

/**
 * Render a stored message template into a discord.js-ready payload, substituting
 * `{placeholder}` tokens and clamping to Discord's limits. A malformed embed
 * (e.g. an invalid image URL) is skipped rather than failing the whole message.
 */
export function renderTemplate(
  template: MessageTemplate,
  vars: Record<string, string>,
): RenderedMessage {
  const content = applyPlaceholders(template.content, vars)?.slice(0, 2000);
  const embeds: EmbedBuilder[] = [];
  for (const e of template.embeds.slice(0, 10)) {
    try {
      const eb = buildEmbed(e, vars);
      if (eb) embeds.push(eb);
    } catch (err) {
      console.error("Skipping invalid template embed:", err);
    }
  }
  return { content: content && content.length > 0 ? content : undefined, embeds };
}
