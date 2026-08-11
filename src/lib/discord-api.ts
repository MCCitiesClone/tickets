import { cache } from "react";
import * as nodeEmoji from "node-emoji";

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
 * Cached for 60s across requests: `/users/@me/guilds` is heavily rate-limited
 * even with the bot token, and the bot's guild list rarely changes. Without this
 * cache, every request that authorizes a user (`canManageGuild`) re-hit the
 * endpoint, hit 429s, and waited on `retry_after` — making channel/config loads
 * slow. Use `fetchBotGuildsFresh` where up-to-the-second freshness matters (the
 * invite-polling status endpoint).
 */
const botGuildsCache = ttlCache<BotGuildsResult>(60_000);

async function fetchBotGuildsUncached(): Promise<BotGuildsResult> {
  try {
    const res = await discordFetch(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` },
    });
    if (!res.ok) return { guilds: [], ok: false };
    const guilds = (await res.json()) as PartialGuild[];
    const result: BotGuildsResult = { guilds, ok: true };
    botGuildsCache.set("bot", result); // shared with the cached path
    return result;
  } catch {
    return { guilds: [], ok: false };
  }
}

export const fetchBotGuilds = cache(async (): Promise<BotGuildsResult> => {
  return botGuildsCache.get("bot") ?? (await fetchBotGuildsUncached());
});

/** Bypass the 60s cache — for the invite-polling status endpoint. */
export function fetchBotGuildsFresh(): Promise<BotGuildsResult> {
  return fetchBotGuildsUncached();
}

// Discord channel types we care about for configuration dropdowns.
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_CATEGORY = 4;
/** Discord permission flag: MANAGE_GUILD (a.k.a. "Manage Server"). */
const PERMISSION_MANAGE_GUILD = 1 << 5;

export type DiscordChannel = {
  id: string;
  name: string;
  /** Parent category id (text channels only); null if uncategorized. */
  parentId?: string | null;
};
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
        parent_id: string | null;
        position: number;
      }[];
      const byPosition = (a: { position: number }, b: { position: number }) =>
        a.position - b.position;
      const result: GuildChannels = {
        categories: channels
          .filter((c) => c.type === CHANNEL_TYPE_CATEGORY)
          .sort(byPosition)
          .map(({ id, name }) => ({ id, name })),
        text: channels
          .filter((c) => c.type === CHANNEL_TYPE_TEXT)
          .sort(byPosition)
          .map(({ id, name, parent_id }) => ({
            id,
            name,
            parentId: parent_id,
          })),
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
  const ch = (await res.json()) as {
    id: string;
    name: string;
    parent_id: string | null;
  };
  return { id: ch.id, name: ch.name, parentId: ch.parent_id };
}

const BUTTON_STYLES: Record<string, number> = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
};

type DiscordEmoji = { id?: string; name?: string; animated?: boolean };

/**
 * Resolve a user-entered button emoji into Discord's emoji object.
 * Accepts a raw unicode emoji (📩), a shortcode name (`:classical_building:` or
 * `classical_building`), or a custom-emoji mention (`<:name:id>` / `<a:name:id>`).
 * Returns null (omit) if it can't be resolved, so we never send an invalid emoji.
 */
function resolveButtonEmoji(raw: string | null): DiscordEmoji | null {
  const input = raw?.trim();
  if (!input) return null;

  // Custom emoji mention.
  const custom = input.match(/^<(a)?:(\w+):(\d+)>$/);
  if (custom) {
    return { animated: Boolean(custom[1]), name: custom[2], id: custom[3] };
  }

  // Shortcode name (colons optional). Use get()'s result directly — has()
  // also returns true for a raw emoji char, but get() then yields undefined.
  const resolved = nodeEmoji.get(input.replace(/^:|:$/g, ""));
  if (resolved) return { name: resolved };

  // Already a raw unicode emoji (contains non-ASCII).
  if ([...input].some((c) => c.charCodeAt(0) > 127)) return { name: input };

  // Unresolvable ASCII text — omit rather than trigger COMPONENT_INVALID_EMOJI.
  return null;
}

/** Shared embed + open-ticket button payload for a panel message. */
function panelMessagePayload(panel: PanelMessageInput) {
  const emoji = resolveButtonEmoji(panel.buttonEmoji);
  return {
    embeds: [
      {
        title: panel.title,
        description: panel.description,
        color: panel.color,
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: BUTTON_STYLES[panel.buttonColor] ?? 1,
            label: panel.buttonLabel,
            custom_id: `open_ticket:${panel.id}`,
            ...(emoji ? { emoji } : {}),
          },
        ],
      },
    ],
  };
}

type PanelMessageInput = {
  id: string;
  title: string;
  description: string;
  color: number;
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
    body: JSON.stringify(panelMessagePayload(panel)),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to post panel message (${res.status}): ${await res.text()}`,
    );
  }
  const msg = (await res.json()) as { id: string };
  return msg.id;
}

/** Edit an already-posted panel message in place. Throws on failure. */
export async function editPanelMessage(
  channelId: string,
  messageId: string,
  panel: PanelMessageInput,
): Promise<void> {
  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(panelMessagePayload(panel)),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to edit panel message (${res.status}): ${await res.text()}`,
    );
  }
}

type MultiPanelMessageInput = {
  id: string;
  title: string;
  description: string;
  color: number;
  largeImageUrl: string | null;
  smallImageUrl: string | null;
  useDropdown: boolean;
};
export type PanelButtonInput = {
  id: string;
  title: string;
  buttonLabel: string;
  buttonEmoji: string | null;
  buttonColor: string;
};

/** Embed + button/dropdown payload for a multi-panel message. */
function multiPanelPayload(
  mp: MultiPanelMessageInput,
  panels: PanelButtonInput[],
) {
  const embed: Record<string, unknown> = {
    title: mp.title,
    description: mp.description,
    color: mp.color,
  };
  if (mp.largeImageUrl) embed.image = { url: mp.largeImageUrl };
  if (mp.smallImageUrl) embed.thumbnail = { url: mp.smallImageUrl };

  let components: unknown[];
  if (mp.useDropdown) {
    // A single string-select menu (max 25 options).
    components = [
      {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: `multipanel_select:${mp.id}`,
            placeholder: "Select a ticket type…",
            options: panels.slice(0, 25).map((p) => {
              const emoji = resolveButtonEmoji(p.buttonEmoji);
              return {
                label: (p.buttonLabel || p.title).slice(0, 100),
                value: p.id,
                description: p.title ? p.title.slice(0, 100) : undefined,
                ...(emoji ? { emoji } : {}),
              };
            }),
          },
        ],
      },
    ];
  } else {
    // Buttons, 5 per action row, up to 5 rows (25 buttons).
    const buttons = panels.slice(0, 25).map((p) => {
      const emoji = resolveButtonEmoji(p.buttonEmoji);
      return {
        type: 2,
        style: BUTTON_STYLES[p.buttonColor] ?? 1,
        label: p.buttonLabel,
        custom_id: `open_ticket:${p.id}`,
        ...(emoji ? { emoji } : {}),
      };
    });
    components = [];
    for (let i = 0; i < buttons.length; i += 5) {
      components.push({ type: 1, components: buttons.slice(i, i + 5) });
    }
  }

  return { embeds: [embed], components };
}

/** Post a multi-panel message, returning the created message id. Throws on error. */
export async function postMultiPanelMessage(
  channelId: string,
  mp: MultiPanelMessageInput,
  panels: PanelButtonInput[],
): Promise<string> {
  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(multiPanelPayload(mp, panels)),
  });
  if (!res.ok) {
    throw new Error(
      `Failed to post multi-panel message (${res.status}): ${await res.text()}`,
    );
  }
  const msg = (await res.json()) as { id: string };
  return msg.id;
}

/** Edit a posted multi-panel message in place. Throws on failure. */
export async function editMultiPanelMessage(
  channelId: string,
  messageId: string,
  mp: MultiPanelMessageInput,
  panels: PanelButtonInput[],
): Promise<void> {
  const res = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${env.DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(multiPanelPayload(mp, panels)),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Failed to edit multi-panel message (${res.status}): ${await res.text()}`,
    );
  }
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
