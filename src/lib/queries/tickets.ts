import { desc } from "drizzle-orm";

import { db } from "@/db";
import { ticket, type Ticket } from "@/db/schema";

/** List recent tickets across all guilds (most recently opened first). */
export async function listTickets(limit = 100): Promise<Ticket[]> {
  return db.select().from(ticket).orderBy(desc(ticket.openedAt)).limit(limit);
}
