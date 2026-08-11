import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate for the dashboard. (In this Next version, middleware is
 * renamed to `proxy` — see node_modules/next/dist/docs/.../16-proxy.md.)
 *
 * We only check for the presence of Better-Auth's session cookie here — a cheap
 * redirect for signed-out users. This is NOT a security boundary: the real
 * session verification happens in the dashboard layout/pages and in every
 * server action via `requireSession()`.
 */
export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  if (!hasSession) {
    const url = new URL("/sign-in", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
