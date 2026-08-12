import { z } from "zod";

/**
 * Zod schema for a stored message template (content + embeds), shared by the
 * guild and panel server actions. Limits follow Discord's embed constraints.
 * Values are lenient (most fields optional) so partially-filled drafts and
 * imported embed-generator JSON validate; the bot's renderer clamps/skips as
 * needed at send time.
 */

const url = z.string().max(2048);

const embedFieldSchema = z.object({
  name: z.string().max(256),
  value: z.string().max(1024),
  inline: z.boolean().optional(),
});

const templateEmbedSchema = z.object({
  author: z
    .object({ name: z.string().max(256), iconUrl: url.optional(), url: url.optional() })
    .partial()
    .optional(),
  title: z.string().max(256).optional(),
  url: url.optional(),
  description: z.string().max(4096).optional(),
  color: z.number().int().min(0).max(0xffffff).optional(),
  fields: z.array(embedFieldSchema).max(25).optional(),
  image: z.object({ url }).optional(),
  thumbnail: z.object({ url }).optional(),
  footer: z
    .object({ text: z.string().max(2048), iconUrl: url.optional() })
    .partial()
    .optional(),
  timestamp: z.string().optional(),
});

export const messageTemplateSchema = z.object({
  content: z.string().max(4000).optional(),
  embeds: z.array(templateEmbedSchema).max(10),
});

/** The four configurable guild-level system messages. */
export const guildMessageTemplatesSchema = z
  .object({
    welcome: messageTemplateSchema,
    claimNotice: messageTemplateSchema,
    closeDm: messageTemplateSchema,
    transcriptPost: messageTemplateSchema,
  })
  .partial();
