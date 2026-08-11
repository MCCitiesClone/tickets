import { desc } from "drizzle-orm";

import { db } from "@/db";
import { panel, type Panel } from "@/db/schema";

/** List all configured ticket panels (most recently created first). */
export async function listPanels(): Promise<Panel[]> {
  return db.select().from(panel).orderBy(desc(panel.createdAt));
}
