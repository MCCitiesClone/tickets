import { type GuildMember, PermissionFlagsBits } from "discord.js";

import type { Guild } from "@/db/schema";

/**
 * Whether a member counts as support staff: they hold one of the guild's
 * configured staff roles, or they can Manage Channels (server managers are
 * always staff). Shared by the ticket commands and the on-call roster so both
 * answer "is this person staff?" the same way.
 */
export function isStaffMember(member: GuildMember, config: Guild): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return config.staffRoleIds.some((r) => member.roles.cache.has(r));
}
