import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better-Auth mounts all its endpoints (OAuth callbacks, session, sign-out, …)
// under /api/auth/*. This catch-all route forwards to its handler.
export const { GET, POST } = toNextJsHandler(auth);
