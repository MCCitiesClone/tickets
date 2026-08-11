import { cache } from "react";

import { env } from "@/lib/env";

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Fetch wrapper that transparently retries on HTTP 429 (Discord rate limit),
 * respecting the `retry_after` hint. Discord rate-limits some endpoints
 * (notably `/users/@me/guilds`) aggressively, so a couple of short retries make
 * reads reliable under bursty dashboard usage.
 */
async function discordFetch(
  url: string,
  init: RequestInit,
  retries = 2,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (res.status !== 429 || attempt >= retries) return res;
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 5) * 1000));
  }
}

/** Tiny module-level TTL cache to avoid re-hitting rate-limited/slow endpoints. */
function ttlCache<T>(ttlMs: number) {
  const store = new Map<string, { at: number; value: T }>();
  return {
    get(key: string): T | undefined {
      const hit = store.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.value;
      return undefined;
    },
    set(key: string, value: T) {
      store.set(key, { at: Date.now(), value });
    },
    delete(key: string) {
      store.delete(key);
    },
  };
}

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
    const res = await discordFetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
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
export type GuildChannels = {
  categories: DiscordChannel[];
  text: DiscordChannel[];
};

// Channels/roles change rarely and the round-trip is slow; cache per guild so
// navigating between pages doesn't re-fetch. Invalidated when we create a
// channel (see `invalidateGuildChannels` / `createGuildChannel`).
const guildChannelsCache = ttlCache<GuildChannels>(5 * 60_000);
const guildRolesCache = ttlCache<DiscordChannel[]>(5 * 60_000);

/** Clear the cached channel list for a guild (e.g. after creating a channel). */
export function invalidateGuildChannels(guildId: string) {
  guildChannelsCache.delete(guildId);
}

/**
 * Fetch a guild's category and text channels via the bot token, split by kind,
 * for use in config dropdowns. Cached per guild; returns empty lists on failure
 * (failures are not cached).
 */
export const fetchGuildChannels = cache(
  async (guildId: string): Promise<GuildChannels> => {
    const cached = guildChannelsCache.get(guildId);
    if (cached) return cached;
    try {
      const res = await discordFetch(
        `${DISCORD_API}/guilds/${guildId}/channels`,
        { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } },
      );
      if (!res.ok) return { categories: [], text: [] };
      const channels = (await res.json()) as {
        id: string;
        name: string;
        type: number;
      }[];
      const result: GuildChannels = {
        categories: channels
          .filter((c) => c.type === CHANNEL_TYPE_CATEGORY)
          .map(({ id, name }) => ({ id, name })),
        text: channels
          .filter((c) => c.type === CHANNEL_TYPE_TEXT)
          .map(({ id, name }) => ({ id, name })),
      };
      guildChannelsCache.set(guildId, result);
      return result;
    } catch {
      return { categories: [], text: [] };
    }
  },
);

/**
 * Fetch a guild's assignable roles via the bot token (excludes @everyone and
 * bot-managed roles). Cached per guild; returns an empty list on failure.
 */
export const fetchGuildRoles = cache(
  async (guildId: string): Promise<DiscordChannel[]> => {
    const cached = guildRolesCache.get(guildId);
    if (cached) return cached;
    try {
      const res = await discordFetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
        headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
      });
      if (!res.ok) return [];
      const roles = (await res.json()) as {
        id: string;
        name: string;
        managed: boolean;
      }[];
      const result = roles
        .filter((r) => r.id !== guildId && !r.managed)
        .map(({ id, name }) => ({ id, name }));
      guildRolesCache.set(guildId, result);
      return result;
    } catch {
      return [];
    }
  },
);

/**
 * Create a channel in a guild via the bot token. `type` maps to a text channel
 * or a category. Invalidates the channel cache so the new channel shows up.
 * Throws on failure.
 */
export async function createGuildChannel(
  guildId: string,
  opts: { name: string; type: "text" | "category"; parentId?: string | null },
): Promise<DiscordChannel> {
  const res = await discordFetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      type: opts.type === "category" ? CHANNEL_TYPE_CATEGORY : CHANNEL_TYPE_TEXT,
      parent_id: opts.parentId || undefined,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to create channel (${res.status}): ${await res.text()}`,
    );
  }
  invalidateGuildChannels(guildId);
  const ch = (await res.json()) as { id: string; name: string };
  return { id: ch.id, name: ch.name };
}

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

// The user's manageable-guild list rarely changes; cache it briefly per token so
// rapid successive requests (page render + the channels API call it triggers)
// don't each hit Discord's tight rate limit on /users/@me/guilds.
const userGuildsCache = ttlCache<{ ids: Set<string>; ok: boolean }>(60_000);

/**
 * Fetch the IDs of guilds the signed-in user can manage (owner or MANAGE_GUILD),
 * using their Discord OAuth access token. Returns `{ ok:false }` if the token is
 * missing/expired or Discord is unreachable. Successful results are cached for a
 * short TTL; failures are not cached so they retry immediately.
 */
export async function fetchUserManageableGuildIds(
  accessToken: string,
): Promise<{ ids: Set<string>; ok: boolean }> {
  const cached = userGuildsCache.get(accessToken);
  if (cached) return cached;

  try {
    const res = await discordFetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${accessToken}` },
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
    const result = { ids, ok: true };
    userGuildsCache.set(accessToken, result);
    return result;
  } catch {
    return { ids: new Set(), ok: false };
  }
}
