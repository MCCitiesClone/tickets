"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client. `baseURL` is omitted so it defaults to the current
 * origin, which is what we want for same-origin dashboard requests.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
