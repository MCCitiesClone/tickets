"use client";

import type { MessageTemplate } from "@/db/schema";
import { Embed } from "@/components/transcript/embed";
import { MarkdownContent } from "@/components/transcript/markdown";
import { isTemplateEmpty } from "@/db/schema";

const BOT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

/**
 * Discord-styled live preview of a message template. Reuses the transcript
 * viewer's `Embed` and `MarkdownContent` renderers. Placeholder `{tokens}` are
 * shown literally.
 */
export function MessagePreview({ template }: { template: MessageTemplate }) {
  return (
    <div className="rounded-lg bg-[#313338] p-4 text-white">
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BOT_AVATAR} alt="" className="size-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">Tickets</span>
            <span className="rounded bg-indigo-500 px-1 text-[10px] font-semibold uppercase leading-4">
              Bot
            </span>
          </div>

          {isTemplateEmpty(template) ? (
            <p className="text-sm text-white/40">Nothing to preview yet.</p>
          ) : (
            <>
              {template.content && (
                <div className="text-sm text-white/90">
                  <MarkdownContent content={template.content} />
                </div>
              )}
              {template.embeds.map((embed, i) => (
                <Embed key={i} embed={embed} mentions={[]} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
