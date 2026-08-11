import { loadEnvConfig } from "@next/env";

// Load .env* before importing anything that reads env.
loadEnvConfig(process.cwd());

/**
 * Apply pending SQL migrations from the ./drizzle folder. Run once on deploy
 * (the Docker `migrate` service does this before web/bot start):
 *
 *   aube run db:migrate:run   # or: tsx src/db/migrate.ts
 */
async function main() {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
