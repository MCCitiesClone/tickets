import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  guild,
  ticket,
  ticketMessage,
  transcript,
  type NewTicket,
  type NewTicketMessage,
  type NewTranscript,
  type Ticket,
  type TicketMessage,
  type TranscriptAttachment,
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
    .set({
      status: "closed",
      closedAt: new Date(),
      closedBy,
      // A closed ticket can't have a pending close request.
      closeRequestedBy: null,
      closeRequestReason: null,
      closeRequestExpiresAt: null,
    })
    .where(eq(ticket.id, id));
}

/** Record a pending close request on a ticket (from `/closerequest`). */
export async function setCloseRequest(
  id: string,
  requestedBy: string,
  reason: string | null,
  expiresAt: Date | null,
): Promise<void> {
  await db
    .update(ticket)
    .set({
      closeRequestedBy: requestedBy,
      closeRequestReason: reason,
      closeRequestExpiresAt: expiresAt,
    })
    .where(eq(ticket.id, id));
}

/** Clear a ticket's pending close request (cancelled or resolved). */
export async function clearCloseRequest(id: string): Promise<void> {
  await db
    .update(ticket)
    .set({
      closeRequestedBy: null,
      closeRequestReason: null,
      closeRequestExpiresAt: null,
    })
    .where(eq(ticket.id, id));
}

/** Open tickets whose unconfirmed close request is now due for auto-close. */
export async function listDueCloseRequests(): Promise<Ticket[]> {
  return db
    .select()
    .from(ticket)
    .where(
      and(
        eq(ticket.status, "open"),
        lte(ticket.closeRequestExpiresAt, new Date()),
      ),
    );
}

/** Set (claim) or clear (`null` = release) a ticket's assigned staff member. */
export async function setTicketClaimedBy(
  id: string,
  claimedBy: string | null,
): Promise<void> {
  await db.update(ticket).set({ claimedBy }).where(eq(ticket.id, id));
}

/** Re-associate a ticket with a different panel. */
export async function setTicketPanel(
  id: string,
  panelId: string,
): Promise<void> {
  await db.update(ticket).set({ panelId }).where(eq(ticket.id, id));
}

/** Record the private staff-notes thread created for a ticket. */
export async function setTicketNotesThread(
  id: string,
  notesThreadId: string,
): Promise<void> {
  await db.update(ticket).set({ notesThreadId }).where(eq(ticket.id, id));
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

/** A captured message reduced to what the attachment archiver needs. */
export type ArchivableMessage = {
  id: string;
  attachments: TranscriptAttachment[];
};

/** Captured messages for a ticket that carry at least one attachment. */
export async function listArchivableTicketMessages(
  ticketId: string,
): Promise<ArchivableMessage[]> {
  return db
    .select({ id: ticketMessage.id, attachments: ticketMessage.attachments })
    .from(ticketMessage)
    .where(
      and(
        eq(ticketMessage.ticketId, ticketId),
        sql`jsonb_array_length(${ticketMessage.attachments}) > 0`,
      ),
    );
}

/** A single captured message (by Discord ID) for live attachment archiving. */
export async function getArchivableTicketMessage(
  ticketId: string,
  discordMessageId: string,
): Promise<ArchivableMessage | null> {
  const [row] = await db
    .select({ id: ticketMessage.id, attachments: ticketMessage.attachments })
    .from(ticketMessage)
    .where(
      and(
        eq(ticketMessage.ticketId, ticketId),
        eq(ticketMessage.discordMessageId, discordMessageId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Replace a captured message's attachments (used to stamp archive keys). */
export async function setMessageAttachments(
  id: string,
  attachments: TranscriptAttachment[],
): Promise<void> {
  await db
    .update(ticketMessage)
    .set({ attachments })
    .where(eq(ticketMessage.id, id));
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

/** A ticket opener resolved to a display name (for the blacklist user picker). */
export type TicketOpener = { id: string; name: string };

/**
 * Distinct users who have opened a ticket in this guild, resolved to their most
 * recent captured display name (falling back to the raw ID). DB-only — no
 * privileged Discord intent required — so it's a practical source for a "who to
 * blacklist" picker. Sorted by name.
 */
export async function listGuildTicketOpeners(
  guildId: string,
): Promise<TicketOpener[]> {
  const [openers, names] = await Promise.all([
    db
      .selectDistinct({ id: ticket.openerId })
      .from(ticket)
      .where(eq(ticket.guildId, guildId)),
    db
      .selectDistinctOn([ticketMessage.authorId], {
        id: ticketMessage.authorId,
        name: ticketMessage.authorTag,
      })
      .from(ticketMessage)
      .innerJoin(ticket, eq(ticket.id, ticketMessage.ticketId))
      .where(eq(ticket.guildId, guildId))
      .orderBy(ticketMessage.authorId, desc(ticketMessage.createdAt)),
  ]);

  const nameMap = new Map(names.map((n) => [n.id, n.name]));
  return openers
    .map((o) => ({ id: o.id, name: nameMap.get(o.id) ?? o.id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Record human activity in a ticket: bump the inactivity clock and clear any
 * pending auto-close warning so the countdown restarts.
 */
export async function markTicketActivity(
  ticketId: string,
  at: Date,
): Promise<void> {
  await db
    .update(ticket)
    .set({ lastActivityAt: at, autoCloseWarnedAt: null })
    .where(eq(ticket.id, ticketId));
}

/** Record that the inactivity auto-close warning was posted. */
export async function markTicketAutoCloseWarned(
  ticketId: string,
  at: Date,
): Promise<void> {
  await db
    .update(ticket)
    .set({ autoCloseWarnedAt: at })
    .where(eq(ticket.id, ticketId));
}

/** An open ticket paired with its guild's auto-close settings. */
export type AutoCloseCandidate = {
  ticket: Ticket;
  autoCloseHours: number;
  autoCloseWarningHours: number;
  autoCloseExcludeClaimed: boolean;
};

/** Open tickets in guilds that have inactivity auto-close enabled. */
export async function listAutoCloseCandidates(): Promise<AutoCloseCandidate[]> {
  return db
    .select({
      ticket,
      autoCloseHours: guild.autoCloseHours,
      autoCloseWarningHours: guild.autoCloseWarningHours,
      autoCloseExcludeClaimed: guild.autoCloseExcludeClaimed,
    })
    .from(ticket)
    .innerJoin(guild, eq(guild.guildId, ticket.guildId))
    .where(and(eq(ticket.status, "open"), gt(guild.autoCloseHours, 0)));
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

/**
 * Store opener feedback on a ticket's transcript. Returns false if there's no
 * transcript for the ticket (e.g. it wasn't captured). Last write wins.
 */
export async function saveTicketRating(
  ticketId: string,
  rating: number,
  comment: string | null,
): Promise<boolean> {
  const [row] = await db
    .update(transcript)
    .set({ rating, feedbackComment: comment, ratedAt: new Date() })
    .where(eq(transcript.ticketId, ticketId))
    .returning({ id: transcript.id });
  return Boolean(row);
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
