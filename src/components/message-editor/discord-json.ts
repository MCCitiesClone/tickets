import type { MessageTemplate, TemplateEmbed } from "@/db/schema";

/**
 * Convert between our `MessageTemplate` shape and the Discord message JSON that
 * embed-generator / Discohook produce (snake_case keys, integer colour), so
 * admins can round-trip templates with those tools.
 */

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function parseColor(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.startsWith("#")) {
    const n = parseInt(v.slice(1), 16);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/** Parse pasted Discord/embed-generator message JSON into a MessageTemplate. */
export function fromDiscordJson(raw: string): MessageTemplate {
  const data = asObject(JSON.parse(raw)) ?? {};
  const embedsRaw = Array.isArray(data.embeds) ? data.embeds : [];

  const embeds: TemplateEmbed[] = embedsRaw.slice(0, 10).map((item) => {
    const e = asObject(item) ?? {};
    const out: TemplateEmbed = {};

    out.title = asString(e.title);
    out.description = asString(e.description);
    out.url = asString(e.url);
    out.color = parseColor(e.color);

    const author = asObject(e.author);
    if (author && asString(author.name)) {
      out.author = {
        name: asString(author.name) as string,
        iconUrl: asString(author.icon_url) ?? asString(author.iconUrl),
        url: asString(author.url),
      };
    }

    if (Array.isArray(e.fields)) {
      out.fields = e.fields.slice(0, 25).map((f) => {
        const field = asObject(f) ?? {};
        return {
          name: asString(field.name) ?? "",
          value: asString(field.value) ?? "",
          inline: Boolean(field.inline),
        };
      });
    }

    const image = asObject(e.image);
    if (image && asString(image.url)) out.image = { url: image.url as string };
    const thumb = asObject(e.thumbnail);
    if (thumb && asString(thumb.url)) out.thumbnail = { url: thumb.url as string };

    const footer = asObject(e.footer);
    if (footer && asString(footer.text)) {
      out.footer = {
        text: asString(footer.text) as string,
        iconUrl: asString(footer.icon_url) ?? asString(footer.iconUrl),
      };
    }

    out.timestamp = asString(e.timestamp);
    return out;
  });

  return { content: asString(data.content), embeds };
}

/** Serialise a MessageTemplate to Discord-compatible JSON (snake_case). */
export function toDiscordJson(template: MessageTemplate): string {
  const embeds = template.embeds.map((e) => {
    const out: Record<string, unknown> = {};
    if (e.title) out.title = e.title;
    if (e.description) out.description = e.description;
    if (e.url) out.url = e.url;
    if (e.color != null) out.color = e.color;
    if (e.author?.name) {
      out.author = {
        name: e.author.name,
        ...(e.author.iconUrl ? { icon_url: e.author.iconUrl } : {}),
        ...(e.author.url ? { url: e.author.url } : {}),
      };
    }
    if (e.fields?.length) {
      out.fields = e.fields.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline ?? false,
      }));
    }
    if (e.image?.url) out.image = { url: e.image.url };
    if (e.thumbnail?.url) out.thumbnail = { url: e.thumbnail.url };
    if (e.footer?.text) {
      out.footer = {
        text: e.footer.text,
        ...(e.footer.iconUrl ? { icon_url: e.footer.iconUrl } : {}),
      };
    }
    if (e.timestamp) out.timestamp = e.timestamp;
    return out;
  });

  const payload: Record<string, unknown> = {};
  if (template.content) payload.content = template.content;
  payload.embeds = embeds;
  return JSON.stringify(payload, null, 2);
}
