import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { panel, type NewPanel, type Panel } from "@/db/schema";

/** List all configured ticket panels (most recently created first). */
export async function listPanels(): Promise<Panel[]> {
  return db.select().from(panel).orderBy(desc(panel.createdAt));
}

/** List panels for a single guild. */
export async function listGuildPanels(guildId: string): Promise<Panel[]> {
  return db
    .select()
    .from(panel)
    .where(eq(panel.guildId, guildId))
    .orderBy(desc(panel.createdAt));
}

export async function getPanel(id: string): Promise<Panel | null> {
  const [row] = await db.select().from(panel).where(eq(panel.id, id)).limit(1);
  return row ?? null;
}

export async function createPanel(values: NewPanel): Promise<Panel> {
  const [row] = await db.insert(panel).values(values).returning();
  return row;
}

/** Record the Discord message the panel was posted as. */
export async function setPanelMessage(
  id: string,
  channelId: string,
  messageId: string,
): Promise<void> {
  await db
    .update(panel)
    .set({ channelId, messageId, updatedAt: new Date() })
    .where(eq(panel.id, id));
}

export async function deletePanel(id: string): Promise<Panel | null> {
  const [row] = await db.delete(panel).where(eq(panel.id, id)).returning();
  return row ?? null;
}
