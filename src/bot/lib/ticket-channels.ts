import { listOpenTicketChannels } from "@/lib/queries/tickets";

/**
 * In-memory index of open ticket channels (`channelId -> ticketId`).
 *
 * `messageCreate` fires for every message in every guild the bot is in, so we
 * must decide *cheaply* whether a channel is a ticket before touching the DB.
 * This map is warmed on ready and kept in sync as tickets open/close, so the
 * message listeners do zero DB reads for the (overwhelming) non-ticket case.
 */
const ticketChannels = new Map<string, string>();

/** Start capturing messages for a ticket channel. */
export function trackTicketChannel(channelId: string, ticketId: string): void {
  ticketChannels.set(channelId, ticketId);
}

/** Stop capturing (call BEFORE deleting the channel so the bulk delete event
 * that Discord fires for the channel's messages is ignored). */
export function untrackTicketChannel(channelId: string): void {
  ticketChannels.delete(channelId);
}

/** The ticket ID for a channel, or `undefined` if it isn't a tracked ticket. */
export function getTrackedTicket(channelId: string): string | undefined {
  return ticketChannels.get(channelId);
}

/** Load all currently-open tickets into the cache. Called once on ready. */
export async function loadOpenTicketChannels(): Promise<number> {
  const rows = await listOpenTicketChannels();
  ticketChannels.clear();
  for (const { id, channelId } of rows) ticketChannels.set(channelId, id);
  return ticketChannels.size;
}

/**
 * Message IDs the transcript capture should ignore — used for bot messages we
 * create only to fire a notification and immediately delete (the ticket
 * "ghost ping"), so they never appear in the transcript.
 */
const ignoredMessages = new Set<string>();

/** Mark a message ID so the capture listeners skip its create and delete. */
export function ignoreMessage(messageId: string): void {
  ignoredMessages.add(messageId);
}

export function isMessageIgnored(messageId: string): boolean {
  return ignoredMessages.has(messageId);
}

/** Stop ignoring a message ID (called once its delete event has been seen). */
export function unignoreMessage(messageId: string): void {
  ignoredMessages.delete(messageId);
}
