import { CornerUpRight } from "lucide-react";

import type { TicketMessage } from "@/db/schema";
import { cn } from "@/lib/utils";
import { Attachments } from "./attachments";
import { Embed } from "./embed";
import { MarkdownContent } from "./markdown";

const AVATAR_FALLBACK =
  "https://cdn.discordapp.com/embed/avatars/0.png";

/** A short one-line preview of the message a reply points at. */
export type ReplyPreview = { authorTag: string; excerpt: string } | null;

function timeLabel(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageRow({
  message,
  replyTo,
  token,
}: {
  message: TicketMessage;
  replyTo: ReplyPreview;
  token: string;
}) {
  const deleted = message.deletedAt != null;

  return (
    <div
      className={cn(
        "flex gap-3 rounded px-2 py-1.5 hover:bg-white/5",
        deleted && "opacity-60",
      )}
      id={message.discordMessageId ?? undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={message.authorAvatarUrl ?? AVATAR_FALLBACK}
        alt=""
        className="mt-0.5 size-10 shrink-0 rounded-full"
      />

      <div className="min-w-0 flex-1">
        {replyTo && (
          <div className="mb-0.5 flex items-center gap-1 text-xs text-white/40">
            <CornerUpRight className="size-3" />
            <span className="font-medium text-white/60">
              {replyTo.authorTag}
            </span>
            <span className="truncate">{replyTo.excerpt}</span>
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="font-medium text-white">{message.authorTag}</span>
          {message.authorBot && (
            <span className="rounded bg-indigo-500 px-1 text-[10px] font-semibold uppercase leading-4 text-white">
              Bot
            </span>
          )}
          <span className="text-xs text-white/40">
            {timeLabel(message.createdAt)}
          </span>
          {message.editedAt && !deleted && (
            <span className="text-xs text-white/30">(edited)</span>
          )}
        </div>

        {deleted ? (
          <div className="text-sm italic text-white/40">
            Message deleted
            {message.content ? (
              <span className="ml-1 line-through">{message.content}</span>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-white/90">
            {message.content && (
              <MarkdownContent
                content={message.content}
                mentions={message.mentions}
              />
            )}
            <Attachments attachments={message.attachments} token={token} />
            {message.embeds.map((embed, i) => (
              <Embed key={i} embed={embed} mentions={message.mentions} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
