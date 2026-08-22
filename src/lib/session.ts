import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { account } from "@/db/schema";
import { auth } from "@/lib/auth";

/**
 * Read the current session on the server. `headers()` is async in this Next
 * version, so it must be awaited before handing to Better-Auth.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Require an authenticated session or redirect to sign-in. Use in dashboard
 * pages/layouts and at the top of every mutating server action (the `proxy.ts`
 * check is only optimistic).
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

/** Who is acting, for audit rows: their Discord ID plus a display name. */
export type SessionActor = { id: string | null; name: string | null };

/**
 * The signed-in user as an audit actor.
 *
 * Resolves the Better-Auth user to their **Discord** snowflake, so a change made
 * in the dashboard attributes to the same ID the bot writes — otherwise the
 * audit log's actor filter would treat one person as two. Returns a null ID if
 * the Discord account link is somehow missing; the name still identifies them.
 */
export const getSessionActor = cache(async (): Promise<SessionActor> => {
  const session = await getSession();
  if (!session) return { id: null, name: null };

  const [linked] = await db
    .select({ accountId: account.accountId })
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "discord"),
      ),
    )
    .limit(1);

  return { id: linked?.accountId ?? null, name: session.user.name ?? null };
});
