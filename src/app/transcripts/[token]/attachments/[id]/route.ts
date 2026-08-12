import type { TranscriptAttachment } from "@/db/schema";
import { readAttachment } from "@/lib/attachment-store";
import { getTranscriptByToken } from "@/lib/queries/tickets";

// Node runtime: this reads archived files from the filesystem.
export const runtime = "nodejs";

/**
 * Content types we're willing to serve inline. Rendering attacker-supplied
 * files on our own origin risks stored XSS (an HTML/SVG "attachment" could run
 * script against the dashboard's session), so only bitmap image types render
 * inline — SVG is intentionally excluded — and everything else downloads.
 */
const INLINE_IMAGE_TYPES: Record<string, string> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
  "image/avif": "image/avif",
};
const EXT_IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

/** A safe inline image content type for this attachment, or null to download. */
function inlineImageType(a: TranscriptAttachment): string | null {
  if (a.contentType && INLINE_IMAGE_TYPES[a.contentType]) return a.contentType;
  const ext = a.name.split(".").pop()?.toLowerCase();
  return (ext && EXT_IMAGE_TYPES[ext]) || null;
}

/**
 * Serve an archived ticket attachment. Access is scoped to the transcript's
 * unguessable share token; only attachments with a stored `archiveKey` are
 * served (originals still on Discord's CDN are linked directly by the viewer).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
): Promise<Response> {
  const { token, id } = await params;

  const data = await getTranscriptByToken(token);
  if (!data) return new Response("Not found", { status: 404 });

  let attachment: TranscriptAttachment | undefined;
  for (const message of data.messages) {
    attachment = message.attachments.find((a) => a.id === id);
    if (attachment) break;
  }
  if (!attachment?.archiveKey) {
    return new Response("Not found", { status: 404 });
  }

  const body = await readAttachment(attachment.archiveKey);
  if (!body) return new Response("Not found", { status: 404 });

  const imageType = inlineImageType(attachment);
  const filename = attachment.name.replace(/["\\\r\n]/g, "_");

  // Copy into a plain ArrayBuffer-backed view so it satisfies BodyInit.
  const bytes = new Uint8Array(body);

  return new Response(bytes.buffer, {
    headers: {
      "Content-Type": imageType ?? "application/octet-stream",
      "Content-Disposition": `${imageType ? "inline" : "attachment"}; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
