import type { TranscriptAttachment } from "@/db/schema";
import { attachmentKey, putAttachment } from "@/lib/attachment-store";
import { env } from "@/lib/env";
import {
  getArchivableTicketMessage,
  listArchivableTicketMessages,
  setMessageAttachments,
  type ArchivableMessage,
} from "@/lib/queries/tickets";

/**
 * Archive ticket attachments off Discord's expiring CDN into our own storage so
 * transcripts stay complete after the channel is deleted.
 *
 * Runs on two paths that share one routine: live (fire-and-forget as each
 * message is captured) and a close-time sweep over every captured row. Because
 * the sweep iterates DB rows — not the live channel — it also covers messages
 * that were deleted mid-ticket. Everything is best-effort: a file that's too big
 * or fails to download is simply left pointing at its Discord URL.
 */

/** An attachment still needs archiving if we haven't stored it and it's small
 *  enough per the configured policy. */
function needsArchive(a: TranscriptAttachment): boolean {
  return !a.archiveKey && a.size <= env.ATTACHMENT_MAX_BYTES;
}

/** Download one attachment into storage, returning its key (or null on skip). */
async function store(
  ticketId: string,
  a: TranscriptAttachment,
): Promise<string | null> {
  try {
    const res = await fetch(a.url);
    if (!res.ok) {
      console.error(`Archive: fetching ${a.name} failed (${res.status})`);
      return null;
    }
    const data = new Uint8Array(await res.arrayBuffer());
    // Re-check the real size; metadata can understate it.
    if (data.byteLength > env.ATTACHMENT_MAX_BYTES) return null;
    const key = attachmentKey(ticketId, a.id);
    await putAttachment(key, data);
    return key;
  } catch (err) {
    console.error(`Archive: storing ${a.name} failed:`, err);
    return null;
  }
}

/** Archive any not-yet-archived attachments on one captured row. */
async function archiveRow(
  ticketId: string,
  row: ArchivableMessage,
): Promise<boolean> {
  let changed = false;
  const next: TranscriptAttachment[] = [];
  for (const a of row.attachments) {
    if (needsArchive(a)) {
      const key = await store(ticketId, a);
      if (key) {
        next.push({ ...a, archiveKey: key });
        changed = true;
        continue;
      }
    }
    next.push(a);
  }
  if (changed) await setMessageAttachments(row.id, next);
  return changed;
}

/**
 * Live path: archive the attachments of a single just-captured message. Safe to
 * call fire-and-forget; no-ops when archiving is disabled or the message has no
 * attachments.
 */
export async function archiveMessageAttachments(
  ticketId: string,
  discordMessageId: string,
): Promise<void> {
  if (!env.ATTACHMENT_ARCHIVE_ENABLED) return;
  const row = await getArchivableTicketMessage(ticketId, discordMessageId);
  if (!row || row.attachments.length === 0) return;
  await archiveRow(ticketId, row);
}

/**
 * Close-time path: archive every outstanding attachment for a ticket. Returns
 * the number of messages whose attachments were (newly) archived.
 */
export async function archiveTicketAttachments(
  ticketId: string,
): Promise<number> {
  if (!env.ATTACHMENT_ARCHIVE_ENABLED) return 0;
  const rows = await listArchivableTicketMessages(ticketId);
  let archived = 0;
  for (const row of rows) {
    if (await archiveRow(ticketId, row)) archived++;
  }
  return archived;
}
