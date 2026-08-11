import { env } from "@/lib/env";

/**
 * Permissions the bot needs to manage ticket channels. Kept as a readable list
 * and OR-ed into the bitfield below. Values are Discord's documented permission
 * flags.
 *
 * View Channels, Manage Channels (create/delete ticket channels), Manage Roles
 * (set per-ticket permission overwrites), Send Messages, Embed Links, Attach
 * Files, Read Message History, Manage Messages.
 */
const PERMISSION_FLAGS = [
  1 << 10, // ViewChannel
  1 << 4, // ManageChannels
  1 << 28, // ManageRoles
  1 << 11, // SendMessages
  1 << 14, // EmbedLinks
  1 << 15, // AttachFiles
  1 << 16, // ReadMessageHistory
  1 << 13, // ManageMessages
];

// These flags all sit below bit 31, so a plain bitwise OR is safe here and
// avoids BigInt literals (tsconfig targets ES2017). Add higher-bit permissions
// via BigInt if ever needed.
const PERMISSIONS = PERMISSION_FLAGS.reduce((acc, f) => acc | f, 0).toString();

/**
 * OAuth2 URL to add the bot to a server, with the `bot` and
 * `applications.commands` scopes and the permissions above pre-selected.
 */
export function botInviteUrl(): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    scope: "bot applications.commands",
    permissions: PERMISSIONS,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
