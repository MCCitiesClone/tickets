import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  ticket,
  ticketMessage,
  transcript,
  type NewTicket,
  type NewTicketMessage,
  type NewTranscript,
  type Ticket,
  type TicketMessage,
  type Transcript,
} from "@/db/schema";

/** A ticket row plus the share token of its transcript, if one exists. */
export type TicketWithTranscript = Ticket & { transcriptToken: string | null };

/** List recent tickets across all guilds (most recently opened first). */
export async function listTickets(limit = 100): Promise<Ticket[]> {
  return db.select().from(ticket).orderBy(desc(ticket.openedAt)).limit(limit);
}

/** List recent tickets for a single guild (most recently opened first). */
export async function listGuildTickets(
  guildId: string,
  limit = 100,
): Promise<TicketWithTranscript[]> {
  const rows = await db
    .select({ ticket, transcriptToken: transcript.token })
    .from(ticket)
    .leftJoin(transcript, eq(transcript.ticketId, ticket.id))
    .where(eq(ticket.guildId, guildId))
    .orderBy(desc(ticket.openedAt))
    .limit(limit);
  return rows.map((r) => ({ ...r.ticket, transcriptToken: r.transcriptToken }));
}

export async function getTicket(id: string): Promise<Ticket | null> {
  const [row] = await db.select().from(ticket).where(eq(ticket.id, id)).limit(1);
  return row ?? null;
}

export async function getTicketByChannel(
  channelId: string,
): Promise<Ticket | null> {
  const [row] = await db
    .select()
    .from(ticket)
    .where(eq(ticket.channelId, channelId))
    .limit(1);
  return row ?? null;
}

/** Number of currently-open tickets a user has in a guild. */
export async function countOpenTicketsForUser(
  guildId: string,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ticket)
    .where(
      and(
        eq(ticket.guildId, guildId),
        eq(ticket.openerId, userId),
        eq(ticket.status, "open"),
      ),
    );
  return row?.count ?? 0;
}

export async function createTicket(values: NewTicket): Promise<Ticket> {
  const [row] = await db.insert(ticket).values(values).returning();
  return row;
}

export async function markTicketClosed(
  id: string,
  closedBy: string,
): Promise<void> {
  await db
    .update(ticket)
    .set({ status: "closed", closedAt: new Date(), closedBy })
    .where(eq(ticket.id, id));
}

/** Set (claim) or clear (`null` = release) a ticket's assigned staff member. */
export async function setTicketClaimedBy(
  id: string,
  claimedBy: string | null,
): Promise<void> {
  await db.update(ticket).set({ claimedBy }).where(eq(ticket.id, id));
}

// --- Transcript capture ----------------------------------------------------

/** Open tickets' channel IDs, used to warm the bot's in-memory capture cache. */
export async function listOpenTicketChannels(): Promise<
  { id: string; channelId: string }[]
> {
  return db
    .select({ id: ticket.id, channelId: ticket.channelId })
    .from(ticket)
    .where(eq(ticket.status, "open"));
}

/**
 * Insert captured messages, skipping any already stored for the same
 * `(ticketId, discordMessageId)`. Real-time listeners are the source of truth,
 * so the on-close sweep only backfills gaps and never clobbers edit/delete
 * state. No-op on an empty batch.
 */
export async function upsertTicketMessages(
  rows: NewTicketMessage[],
): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(ticketMessage)
    .values(rows)
    .onConflictDoNothing({
      target: [ticketMessage.ticketId, ticketMessage.discordMessageId],
    });
}

/** Record an edit to a captured message (matched by Discord message ID). */
export async function markMessageEdited(
  discordMessageId: string,
  content: string,
  editedAt: Date,
): Promise<void> {
  await db
    .update(ticketMessage)
    .set({ content, editedAt })
    .where(eq(ticketMessage.discordMessageId, discordMessageId));
}

/** Mark a captured message as deleted (matched by Discord message ID). */
export async function markMessageDeleted(
  discordMessageId: string,
  deletedAt: Date,
): Promise<void> {
  await db
    .update(ticketMessage)
    .set({ deletedAt })
    .where(eq(ticketMessage.discordMessageId, discordMessageId));
}

/** Count captured messages for a ticket. */
export async function countTicketMessages(ticketId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ticketMessage)
    .where(eq(ticketMessage.ticketId, ticketId));
  return row?.count ?? 0;
}

/** Create the (single) transcript record for a ticket. */
export async function createTranscript(
  values: NewTranscript,
): Promise<Transcript> {
  const [row] = await db.insert(transcript).values(values).returning();
  return row;
}

/** The transcript for a ticket, if one has been created. */
export async function getTranscriptForTicket(
  ticketId: string,
): Promise<Transcript | null> {
  const [row] = await db
    .select()
    .from(transcript)
    .where(eq(transcript.ticketId, ticketId))
    .limit(1);
  return row ?? null;
}

/** Resolve a public share token to its transcript, ticket, and messages. */
export async function getTranscriptByToken(token: string): Promise<{
  transcript: Transcript;
  ticket: Ticket;
  messages: TicketMessage[];
} | null> {
  const [row] = await db
    .select({ transcript, ticket })
    .from(transcript)
    .innerJoin(ticket, eq(ticket.id, transcript.ticketId))
    .where(eq(transcript.token, token))
    .limit(1);
  if (!row) return null;

  const messages = await db
    .select()
    .from(ticketMessage)
    .where(eq(ticketMessage.ticketId, row.ticket.id))
    .orderBy(asc(ticketMessage.createdAt), asc(ticketMessage.id));

  return { transcript: row.transcript, ticket: row.ticket, messages };
}
