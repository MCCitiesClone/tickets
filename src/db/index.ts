import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Shared Drizzle client used by both the web app and the Discord bot process.
 *
 * A single `pg` Pool is created per process. In Next.js dev, module state is
 * reused across HMR reloads via `globalThis` so we don't leak connections.
 */
const globalForDb = globalThis as unknown as {
  __ticketsPool?: Pool;
};

const pool =
  globalForDb.__ticketsPool ?? new Pool({ connectionString: env.DATABASE_URL });

if (env.NODE_ENV !== "production") {
  globalForDb.__ticketsPool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
export type Database = typeof db;
