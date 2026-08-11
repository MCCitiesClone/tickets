import { and, desc, eq, gt, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  multiPanel,
  panel,
  panelCooldown,
  type MultiPanel,
  type NewMultiPanel,
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

/** Fetch panels by id, returned in the order of the given id list. */
export async function getPanelsByIds(ids: string[]): Promise<Panel[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(panel).where(inArray(panel.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((p): p is Panel => Boolean(p));
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

/** Clear a panel's posted-message reference (e.g. when it's no longer posted). */
export async function clearPanelMessage(id: string): Promise<void> {
  await db
    .update(panel)
    .set({ channelId: null, messageId: null, updatedAt: new Date() })
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

// --- Multi-panels ----------------------------------------------------------

export async function listGuildMultiPanels(
  guildId: string,
): Promise<MultiPanel[]> {
  return db
    .select()
    .from(multiPanel)
    .where(eq(multiPanel.guildId, guildId))
    .orderBy(desc(multiPanel.createdAt));
}

export async function getMultiPanel(id: string): Promise<MultiPanel | null> {
  const [row] = await db
    .select()
    .from(multiPanel)
    .where(eq(multiPanel.id, id))
    .limit(1);
  return row ?? null;
}

export async function createMultiPanel(
  values: NewMultiPanel,
): Promise<MultiPanel> {
  const [row] = await db.insert(multiPanel).values(values).returning();
  return row;
}

export async function updateMultiPanel(
  id: string,
  values: Partial<Omit<NewMultiPanel, "id" | "guildId">>,
): Promise<MultiPanel | null> {
  const [row] = await db
    .update(multiPanel)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(multiPanel.id, id))
    .returning();
  return row ?? null;
}

export async function setMultiPanelMessage(
  id: string,
  channelId: string,
  messageId: string,
): Promise<void> {
  await db
    .update(multiPanel)
    .set({ channelId, messageId, updatedAt: new Date() })
    .where(eq(multiPanel.id, id));
}

export async function deleteMultiPanel(id: string): Promise<MultiPanel | null> {
  const [row] = await db
    .delete(multiPanel)
    .where(eq(multiPanel.id, id))
    .returning();
  return row ?? null;
}

/** Clear all active cooldowns for a panel. Returns how many were cleared. */
export async function resetCooldowns(panelId: string): Promise<number> {
  const rows = await db
    .delete(panelCooldown)
    .where(eq(panelCooldown.panelId, panelId))
    .returning({ userId: panelCooldown.userId });
  return rows.length;
}
