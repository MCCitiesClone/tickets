import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
