import type { MessageTemplate, TemplateEmbed } from "@/db/schema";

/**
 * Render a stored message template into a raw Discord REST message payload
 * (content + embeds as plain JSON), clamped to Discord's per-field limits.
 *
 * This is the web-side counterpart to the bot's `renderTemplate`
 * (`src/bot/lib/message-template.ts`, which builds discord.js `EmbedBuilder`s).
 * It exists so server actions that post messages through the raw REST API — the
 * multi-panel message — can reuse a template without pulling in discord.js.
 * Unlike the bot renderer it does not substitute `{placeholder}` tokens: the
 * messages it renders are static, so any tokens are left as-is.
 */

/** Trim to a max length, dropping the value entirely if it ends up empty. */
function clamp(value: string | undefined, max: number): string | undefined {
  const out = value?.slice(0, max);
  return out && out.length > 0 ? out : undefined;
}

/** Build a raw Discord embed from a template embed, or null if it's empty. */
function toApiEmbed(e: TemplateEmbed): Record<string, unknown> | null {
  const embed: Record<string, unknown> = {};
  let has = false;

  const title = clamp(e.title, 256);
  if (title) {
    embed.title = title;
    has = true;
  }
  const description = clamp(e.description, 4096);
  if (description) {
    embed.description = description;
    has = true;
  }
  if (e.url) embed.url = e.url;
  if (e.color != null) embed.color = e.color;

  if (e.author?.name) {
    embed.author = {
      name: e.author.name.slice(0, 256),
      icon_url: e.author.iconUrl || undefined,
      url: e.author.url || undefined,
    };
    has = true;
  }

  if (e.fields?.length) {
    embed.fields = e.fields.slice(0, 25).map((f) => ({
      // Discord rejects empty name/value; fall back to a zero-width space.
      name: (clamp(f.name, 256) ?? "​"),
      value: (clamp(f.value, 1024) ?? "​"),
      inline: f.inline ?? false,
    }));
    has = true;
  }

  if (e.image?.url) {
    embed.image = { url: e.image.url };
    has = true;
  }
  if (e.thumbnail?.url) {
    embed.thumbnail = { url: e.thumbnail.url };
    has = true;
  }

  if (e.footer?.text) {
    embed.footer = {
      text: e.footer.text.slice(0, 2048),
      icon_url: e.footer.iconUrl || undefined,
    };
    has = true;
  }

  if (e.timestamp) {
    const date = new Date(e.timestamp);
    if (!Number.isNaN(date.getTime())) embed.timestamp = date.toISOString();
  }

  return has ? embed : null;
}

export type RenderedMessageJson = {
  content?: string;
  embeds: Record<string, unknown>[];
};

/** Render a template into `{ content?, embeds }` for the raw Discord REST API. */
export function renderTemplateToJson(
  template: MessageTemplate,
): RenderedMessageJson {
  const embeds: Record<string, unknown>[] = [];
  for (const e of template.embeds.slice(0, 10)) {
    const api = toApiEmbed(e);
    if (api) embeds.push(api);
  }
  return { content: clamp(template.content, 2000), embeds };
}
