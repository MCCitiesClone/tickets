import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db, schema } from "@/db";
import { env } from "@/lib/env";

/**
 * Better-Auth server instance for the dashboard.
 *
 * Auth is Discord-only: users sign in with the same Discord account they use in
 * the servers this bot manages. The `guilds` scope lets us list the servers a
 * user belongs to so the dashboard can show only the guilds they can manage.
 *
 * `nextCookies()` must be the LAST plugin — it sets auth cookies on Next.js
 * server actions/route handlers automatically.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  socialProviders: {
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      scope: ["identify", "email", "guilds"],
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
