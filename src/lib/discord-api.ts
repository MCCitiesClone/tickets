import { cache } from "react";

import { env } from "@/lib/env";

const DISCORD_API = "https://discord.com/api/v10";

export type PartialGuild = { id: string; name: string };

export type BotGuildsResult = {
  /** Guilds the bot is a member of (empty if unreachable). */
  guilds: PartialGuild[];
  /** Whether the Discord API call succeeded. `false` means "unknown", not "0". */
  ok: boolean;
};

/**
 * Fetch the guilds the bot is currently a member of, using the bot token.
 *
 * Wrapped in React `cache()` so it runs at most once per request. Failures
 * resolve to `{ guilds: [], ok: false }` so callers can tell "Discord is
 * unreachable" apart from "the bot genuinely isn't in any server" and avoid
 * showing misleading checklist state.
 */
export const fetchBotGuilds = cache(async (): Promise<BotGuildsResult> => {
  try {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return { guilds: [], ok: false };
    const guilds = (await res.json()) as PartialGuild[];
    return { guilds, ok: true };
  } catch {
    return { guilds: [], ok: false };
  }
});

// Discord channel types we care about for configuration dropdowns.
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_CATEGORY = 4;
/** Discord permission flag: MANAGE_GUILD (a.k.a. "Manage Server"). */
const PERMISSION_MANAGE_GUILD = 1 << 5;

export type DiscordChannel = { id: string; name: string };

/**
 * Fetch a guild's category and text channels via the bot token, split by kind,
 * for use in config dropdowns. Returns empty lists on failure.
 */
export const fetchGuildChannels = cache(
  async (
    guildId: string,
  ): Promise<{ categories: DiscordChannel[]; text: DiscordChannel[] }> => {
    try {
      const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
        cache: "no-store",
      });
      if (!res.ok) return { categories: [], text: [] };
      const channels = (await res.json()) as {
        id: string;
        name: string;
        type: number;
      }[];
      return {
        categories: channels
          .filter((c) => c.type === CHANNEL_TYPE_CATEGORY)
          .map(({ id, name }) => ({ id, name })),
        text: channels
          .filter((c) => c.type === CHANNEL_TYPE_TEXT)
          .map(({ id, name }) => ({ id, name })),
      };
    } catch {
      return { categories: [], text: [] };
    }
  },
);

/**
 * Fetch a guild's assignable roles via the bot token (excludes @everyone and
 * bot-managed roles). Returns an empty list on failure.
 */
export const fetchGuildRoles = cache(
  async (guildId: string): Promise<DiscordChannel[]> => {
    try {
      const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
        cache: "no-store",
      });
      if (!res.ok) return [];
      const roles = (await res.json()) as {
        id: string;
        name: string;
        managed: boolean;
      }[];
      return roles
        .filter((r) => r.id !== guildId && !r.managed)
        .map(({ id, name }) => ({ id, name }));
    } catch {
      return [];
    }
  },
);

const BUTTON_STYLES: Record<string, number> = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
};

type PanelMessageInput = {
  id: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonColor: string;
};

/**
 * Post a panel's embed + "open ticket" button into a channel via the bot token,
 * returning the created message ID. The button's `custom_id` encodes the panel
 * ID so the bot can route clicks (`open_ticket:<panelId>`). Throws on failure so
 * the caller can surface it.
 */
export async function postPanelMessage(
  channelId: string,
  panel: PanelMessageInput,
): Promise<string> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [{ title: panel.title, description: panel.description }],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: BUTTON_STYLES[panel.buttonColor] ?? 1,
              label: panel.buttonLabel,
              custom_id: `open_ticket:${panel.id}`,
              ...(panel.buttonEmoji
                ? { emoji: { name: panel.buttonEmoji } }
                : {}),
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to post panel message (${res.status}): ${await res.text()}`,
    );
  }
  const msg = (await res.json()) as { id: string };
  return msg.id;
}

/** Best-effort delete of a message (e.g. when a panel is removed). */
export async function deleteMessage(
  channelId: string,
  messageId: string,
): Promise<void> {
  try {
    await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
    });
  } catch {
    // best-effort
  }
}

/**
 * Fetch the IDs of guilds the signed-in user can manage (owner or MANAGE_GUILD),
 * using their Discord OAuth access token. Returns `{ ok:false }` if the token is
 * missing/expired or Discord is unreachable.
 */
export async function fetchUserManageableGuildIds(
  accessToken: string,
): Promise<{ ids: Set<string>; ok: boolean }> {
  try {
    const res = await fetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return { ids: new Set(), ok: false };
    const guilds = (await res.json()) as {
      id: string;
      owner: boolean;
      permissions: string;
    }[];
    const ids = new Set(
      guilds
        .filter(
          (g) =>
            g.owner ||
            (BigInt(g.permissions) & BigInt(PERMISSION_MANAGE_GUILD)) !==
              BigInt(0),
        )
        .map((g) => g.id),
    );
    return { ids, ok: true };
  } catch {
    return { ids: new Set(), ok: false };
  }
}
