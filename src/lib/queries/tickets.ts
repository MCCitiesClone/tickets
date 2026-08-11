import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { ticket, type NewTicket, type Ticket } from "@/db/schema";

/** List recent tickets across all guilds (most recently opened first). */
export async function listTickets(limit = 100): Promise<Ticket[]> {
  return db.select().from(ticket).orderBy(desc(ticket.openedAt)).limit(limit);
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
