import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside the Next.js runtime, so load .env* ourselves the
// same way Next.js does (respects .env.local, .env.development, etc.).
loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — needed for drizzle-kit.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle",
  dbCredentials: { url },
  casing: "snake_case",
  verbose: true,
  strict: true,
});
