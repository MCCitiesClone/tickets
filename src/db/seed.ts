import { loadEnvConfig } from "@next/env";

// Load .env* before importing the db client (which validates env on import).
loadEnvConfig(process.cwd());

async function main() {
  // Import lazily so env is loaded first.
  const { db } = await import("./index");

  // NOTE (scaffold): no seed data yet. Guild config rows are created on demand
  // when a server is configured via the dashboard or `/setup`. Add development
  // fixtures here as the schema grows.
  void db;

  console.log("Nothing to seed yet. Add fixtures in src/db/seed.ts.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
