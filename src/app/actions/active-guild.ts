"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ACTIVE_GUILD_COOKIE } from "@/lib/active-guild";
import { canManageGuild } from "@/lib/guild-access";
import { requireSession } from "@/lib/session";

/** Set the active guild cookie after verifying the user can manage it. */
export async function setActiveGuild(guildId: string) {
  await requireSession();
  if (!(await canManageGuild(guildId))) {
    throw new Error("You don't have permission to manage this server.");
  }
  (await cookies()).set(ACTIVE_GUILD_COOKIE, guildId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  // Refresh every dashboard route so they re-render for the new active guild.
  revalidatePath("/dashboard", "layout");
}
