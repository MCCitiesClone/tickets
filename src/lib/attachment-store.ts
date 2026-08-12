import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { env } from "./env";

/**
 * Local-filesystem storage for archived ticket attachments, shared by the bot
 * (which downloads and writes) and the web app (which serves). In Docker both
 * processes mount the same volume at `ATTACHMENT_ARCHIVE_DIR`.
 *
 * This is deliberately a thin, backend-agnostic surface (`put` / `read` /
 * `delete` over opaque string keys) so an S3/MinIO backend can replace the
 * filesystem calls later without touching callers.
 */

// Fall back to the default when env validation is skipped (e.g. `next build`),
// where `env.ATTACHMENT_ARCHIVE_DIR` may be undefined. The archive dir is a
// runtime location, not a bundled asset, so opt out of Next's file tracing
// (which would otherwise pull the whole project into the standalone output).
const ROOT = resolve(
  /* turbopackIgnore: true */ env.ATTACHMENT_ARCHIVE_DIR ?? ".data/attachments",
);

/** Resolve a key to an absolute path, refusing anything that escapes ROOT. */
function keyPath(key: string): string {
  const full = resolve(ROOT, key);
  if (full !== ROOT && !full.startsWith(ROOT + sep)) {
    throw new Error(`Unsafe attachment key: ${key}`);
  }
  return full;
}

const clean = (segment: string): string => segment.replace(/[^\w.-]/g, "_");

/** Deterministic storage key for a ticket's attachment. */
export function attachmentKey(ticketId: string, attachmentId: string): string {
  return `${clean(ticketId)}/${clean(attachmentId)}`;
}

/** Write (or overwrite) an archived attachment. */
export async function putAttachment(
  key: string,
  data: Uint8Array,
): Promise<void> {
  const full = keyPath(key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
}

/** Read an archived attachment, or null if it isn't stored. */
export async function readAttachment(key: string): Promise<Buffer | null> {
  try {
    return await readFile(keyPath(key));
  } catch {
    return null;
  }
}

/** Whether an archived attachment exists. */
export async function attachmentExists(key: string): Promise<boolean> {
  try {
    await access(keyPath(key));
    return true;
  } catch {
    return false;
  }
}

/** Remove every archived file for a ticket (retention / cleanup). */
export async function deleteTicketAttachments(ticketId: string): Promise<void> {
  await rm(keyPath(clean(ticketId)), { recursive: true, force: true });
}
