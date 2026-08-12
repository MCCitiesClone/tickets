import { z } from "zod";

/**
 * Centralized, validated environment configuration shared by BOTH runtime
 * processes (the Next.js web app and the standalone Discord bot).
 *
 * The web app has its `.env*` files loaded automatically by Next.js. The bot
 * process is NOT run by Next.js, so `src/bot/index.ts` calls `loadEnvConfig()`
 * from `@next/env` *before* importing anything that reads from here.
 *
 * Import `env` for fully-typed, validated access. Never read `process.env`
 * directly elsewhere.
 */

const schema = z.object({
  // --- Database -----------------------------------------------------------
  DATABASE_URL: z
    .string()
    .url()
    .describe("Postgres connection string, e.g. postgres://user:pass@host:5432/db"),

  // --- Discord ------------------------------------------------------------
  /** Bot token from the Discord Developer Portal → Bot. Used by the gateway. */
  DISCORD_TOKEN: z.string().min(1),
  /** Application (client) ID. Used for OAuth and slash-command registration. */
  DISCORD_CLIENT_ID: z.string().min(1),
  /** OAuth2 client secret. Used by Better-Auth for the dashboard sign-in. */
  DISCORD_CLIENT_SECRET: z.string().min(1),

  // --- Auth (web only, but harmless for the bot to have) ------------------
  /** Random 32+ char secret. Generate with `openssl rand -base64 32`. */
  BETTER_AUTH_SECRET: z.string().min(1),
  /** Public base URL of the web app, e.g. http://localhost:3000 */
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),

  // --- Attachment archiving ----------------------------------------------
  /**
   * Directory where the bot stores archived ticket attachments and the web app
   * serves them from. Both processes need the SAME path; in Docker this is a
   * shared volume. Relative paths resolve from the process working directory.
   */
  ATTACHMENT_ARCHIVE_DIR: z.string().min(1).default(".data/attachments"),
  /**
   * Set to "false" to disable archiving entirely — transcripts then keep the
   * original Discord CDN URLs (which expire). Defaults on.
   */
  ATTACHMENT_ARCHIVE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  /** Skip archiving attachments larger than this many bytes (default 25 MiB). */
  ATTACHMENT_MAX_BYTES: z.coerce.number().int().positive().default(26_214_400),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof schema>;

/**
 * Validate `process.env` once. Throws a readable error listing every missing or
 * malformed variable so misconfiguration fails fast at startup (both processes).
 */
function loadEnv(): Env {
  // Allow `next build` (and CI type-checks) to run without real secrets. The
  // Docker web build sets this; real values are still required at runtime.
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as Env;
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Check your .env file:\n${issues}`,
    );
  }
  return parsed.data;
}

export const env = loadEnv();
