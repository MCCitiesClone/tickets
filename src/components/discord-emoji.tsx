import * as nodeEmoji from "node-emoji";

const CUSTOM = /^<(a)?:(\w+):(\d+)>$/;

/**
 * Render a user-entered emoji the way the bot does: a custom-emoji mention
 * (`<:name:id>` / `<a:name:id>`) as its CDN image, a `:shortcode:`/name as its
 * unicode glyph, or a raw unicode emoji as-is. Renders nothing for anything that
 * can't be resolved (matching the bot omitting invalid emoji).
 */
export function DiscordEmoji({
  emoji,
  className = "inline-block size-4 align-[-0.125em]",
}: {
  emoji: string | null | undefined;
  className?: string;
}) {
  const input = emoji?.trim();
  if (!input) return null;

  const custom = input.match(CUSTOM);
  if (custom) {
    const [, animated, name, id] = custom;
    const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=32`;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className={className} />;
  }

  const glyph =
    nodeEmoji.get(input.replace(/^:|:$/g, "")) ||
    ([...input].some((c) => c.charCodeAt(0) > 127) ? input : null);
  if (!glyph) return null;
  return <span className={className}>{glyph}</span>;
}
