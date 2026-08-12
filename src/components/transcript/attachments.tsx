import { FileIcon } from "lucide-react";

import type { TranscriptAttachment } from "@/db/schema";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(a: TranscriptAttachment): boolean {
  return (
    a.contentType?.startsWith("image/") ??
    /\.(png|jpe?g|gif|webp|avif)$/i.test(a.name)
  );
}

export function Attachments({
  attachments,
}: {
  attachments: TranscriptAttachment[];
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-1 flex flex-col gap-2">
      {attachments.map((a) =>
        isImage(a) ? (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block w-fit"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url}
              alt={a.name}
              className="max-h-80 max-w-full rounded-md"
            />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex w-fit items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
          >
            <FileIcon className="size-4 text-sky-400" />
            <span className="text-sky-400">{a.name}</span>
            <span className="text-white/40">{humanSize(a.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}
