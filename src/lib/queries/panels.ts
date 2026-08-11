import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import {
  panel,
  panelCooldown,
  type NewPanel,
  type Panel,
} from "@/db/schema";

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

/** Update a panel's configuration fields. */
export async function updatePanel(
  id: string,
  values: Partial<Omit<NewPanel, "id" | "guildId">>,
): Promise<Panel | null> {
  const [row] = await db
    .update(panel)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(panel.id, id))
    .returning();
  return row ?? null;
}

export async function deletePanel(id: string): Promise<Panel | null> {
  const [row] = await db.delete(panel).where(eq(panel.id, id)).returning();
  return row ?? null;
}

// --- Cooldowns -------------------------------------------------------------

/** True if the user is currently on cooldown for this panel. */
export async function isOnCooldown(
  panelId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ expiresAt: panelCooldown.expiresAt })
    .from(panelCooldown)
    .where(
      and(
        eq(panelCooldown.panelId, panelId),
        eq(panelCooldown.userId, userId),
        gt(panelCooldown.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Start/refresh a user's cooldown for a panel. */
export async function startCooldown(
  panelId: string,
  userId: string,
  seconds: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + seconds * 1000);
  await db
    .insert(panelCooldown)
    .values({ panelId, userId, expiresAt })
    .onConflictDoUpdate({
      target: [panelCooldown.panelId, panelCooldown.userId],
      set: { expiresAt },
    });
}

/** Clear all active cooldowns for a panel. Returns how many were cleared. */
export async function resetCooldowns(panelId: string): Promise<number> {
  const rows = await db
    .delete(panelCooldown)
    .where(eq(panelCooldown.panelId, panelId))
    .returning({ userId: panelCooldown.userId });
  return rows.length;
}
