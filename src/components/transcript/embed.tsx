import type { TranscriptEmbed, TranscriptMention } from "@/db/schema";
import { MarkdownContent } from "./markdown";

/** Render a captured Discord embed with its accent colour and fields. */
export function Embed({
  embed,
  mentions,
}: {
  embed: TranscriptEmbed;
  mentions: TranscriptMention[];
}) {
  const accent =
    embed.color != null
      ? `#${embed.color.toString(16).padStart(6, "0")}`
      : "#4f545c";

  return (
    <div
      className="mt-1 max-w-lg rounded-md border-l-4 bg-black/20 p-3 text-sm"
      style={{ borderColor: accent }}
    >
      {/* Content column on the left; thumbnail floats to the top-right beside
          it (matching Discord), with the main image below at full width. */}
      <div className="flex gap-4">
        <div className="grid min-w-0 flex-1 gap-1">
          {embed.author?.name && (
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              {embed.author.iconUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={embed.author.iconUrl}
                  alt=""
                  className="size-5 rounded-full"
                />
              )}
              <span>{embed.author.name}</span>
            </div>
          )}

          {embed.title &&
            (embed.url ? (
              <a
                href={embed.url}
                target="_blank"
                rel="noreferrer noopener"
                className="font-semibold text-sky-400 hover:underline"
              >
                {embed.title}
              </a>
            ) : (
              <div className="font-semibold text-white">{embed.title}</div>
            ))}

          {embed.description && (
            <div className="text-white/85">
              <MarkdownContent content={embed.description} mentions={mentions} />
            </div>
          )}

          {embed.fields && embed.fields.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
              {embed.fields.map((f, i) => (
                <div
                  key={i}
                  className={f.inline ? "min-w-[8rem] flex-1" : "w-full"}
                >
                  <div className="text-xs font-semibold text-white">
                    {f.name}
                  </div>
                  <div className="text-white/80">
                    <MarkdownContent content={f.value} mentions={mentions} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {embed.thumbnail?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={embed.thumbnail.url}
            alt=""
            className="size-20 shrink-0 rounded-md object-cover"
          />
        )}
      </div>

      {embed.image?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={embed.image.url} alt="" className="mt-2 max-h-72 rounded-md" />
      )}

      {embed.footer?.text && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
          {embed.footer.iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={embed.footer.iconUrl}
              alt=""
              className="size-4 rounded-full"
            />
          )}
          <span>{embed.footer.text}</span>
        </div>
      )}
    </div>
  );
}
