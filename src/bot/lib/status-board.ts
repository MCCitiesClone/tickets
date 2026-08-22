import { EmbedBuilder, type Guild as DiscordGuild } from "discord.js";

import type { Guild } from "@/db/schema";
import {
  listOpenTicketsForBoard,
  setStatusBoardMessage,
  type BoardTicket,
} from "@/lib/queries/tickets";
import { priorityMeta } from "@/lib/ticket-priority";
import { EMBED_COLOR } from "./embeds";

/**
 * The live status board: a read-only overview of every open ticket, grouped by
 * the category its channel sits in.
 *
 * Rendering is pure and separated from posting so the layout — and every
 * Discord limit it has to respect — can be reasoned about without a gateway.
 */

/** Discord's per-embed description limit. */
const MAX_DESCRIPTION = 4096;
/** Discord's per-message embed limit; one embed per category group. */
const MAX_GROUPS = 10;
/** Tickets listed per category before the rest are summarised. */
const MAX_ROWS_PER_GROUP = 20;
/** Discord's combined limit across all embeds in a message. */
const MAX_TOTAL_CHARS = 6000;

/** Tickets under one category heading, in the order they'll be shown. */
export type BoardGroup = {
  /** Category channel ID, or null for tickets whose channel has no parent. */
  categoryId: string | null;
  name: string;
  tickets: BoardTicket[];
};

const WAITING_LABEL = {
  staff: "⏳ Waiting on staff",
  user: "💬 Waiting on user",
} as const;

/**
 * Group open tickets by the category their channel lives under.
 *
 * Categories are looked up per ticket rather than stored, because a ticket can
 * be moved — by `/switchpanel`, or by an admin dragging the channel — and the
 * board should reflect where it actually is now.
 */
export function groupTicketsByCategory(
  tickets: BoardTicket[],
  categoryOf: (channelId: string) => { id: string; name: string } | null,
): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();

  for (const ticket of tickets) {
    const category = categoryOf(ticket.channelId);
    const key = category?.id ?? "";
    const existing = groups.get(key);
    if (existing) {
      existing.tickets.push(ticket);
    } else {
      groups.set(key, {
        categoryId: category?.id ?? null,
        name: category?.name ?? "Uncategorised",
        tickets: [ticket],
      });
    }
  }

  // Busiest category first — that's where attention is needed.
  return [...groups.values()].sort(
    (a, b) => b.tickets.length - a.tickets.length || a.name.localeCompare(b.name),
  );
}

/** One ticket's line on the board. */
export function renderTicketRow(ticket: BoardTicket): string {
  const opened = Math.floor(ticket.openedAt.getTime() / 1000);
  const priority = priorityMeta(ticket.priority);
  const claimed = ticket.claimedBy
    ? `<@${ticket.claimedBy}>`
    : "*unclaimed*";

  return (
    `${priority.emoji} <#${ticket.channelId}> · <@${ticket.openerId}> · ` +
    `${claimed} · ${WAITING_LABEL[ticket.waitingOn]} · <t:${opened}:R>`
  );
}

/**
 * Build the board's embeds: one per category, newest tickets first within each.
 *
 * Long groups are truncated with a count of the remainder rather than being
 * dropped — an operator seeing "and 14 more" knows to look, whereas a silently
 * shortened list reads as the whole queue.
 */
export function buildStatusBoard(
  groups: BoardGroup[],
  now: Date = new Date(),
): EmbedBuilder[] {
  const total = groups.reduce((n, g) => n + g.tickets.length, 0);
  const updated = Math.floor(now.getTime() / 1000);

  if (total === 0) {
    return [
      new EmbedBuilder()
        .setTitle("🎫 Open tickets")
        .setColor(EMBED_COLOR.neutral)
        .setDescription(
          `No tickets are open right now.\n\n-# Updated <t:${updated}:R>`,
        ),
    ];
  }

  const shown = groups.slice(0, MAX_GROUPS);
  const hiddenGroups = groups.length - shown.length;
  const embeds: EmbedBuilder[] = [];
  let used = 0;

  for (const [index, group] of shown.entries()) {
    const rows = group.tickets.slice(0, MAX_ROWS_PER_GROUP).map(renderTicketRow);
    const overflow = group.tickets.length - rows.length;
    if (overflow > 0) rows.push(`-# …and ${overflow} more`);

    // The last embed carries the footer lines, so trim to leave room for them.
    const isLast = index === shown.length - 1;
    const footer = isLast
      ? `\n\n-# ${total} open · updated <t:${updated}:R>` +
        (hiddenGroups > 0 ? ` · ${hiddenGroups} more categories` : "")
      : "";

    let description = rows.join("\n");
    if (description.length + footer.length > MAX_DESCRIPTION) {
      description = description.slice(0, MAX_DESCRIPTION - footer.length - 1);
    }
    description += footer;

    // Never exceed Discord's combined budget across the whole message.
    if (used + description.length > MAX_TOTAL_CHARS) break;
    used += description.length;

    embeds.push(
      new EmbedBuilder()
        .setTitle(`🎫 ${group.name} — ${group.tickets.length}`)
        .setColor(EMBED_COLOR.info)
        .setDescription(description),
    );
  }

  return embeds;
}

/**
 * In-memory fingerprint of what each guild's board last showed.
 *
 * The refresh runs on a timer, and most ticks change nothing — comparing here
 * means a quiet server costs zero Discord calls instead of an edit a minute.
 * Losing this on restart just means one redundant edit.
 */
const lastRendered = new Map<string, string>();

/** Reset the fingerprint so the next refresh definitely edits. */
export function invalidateStatusBoard(guildId: string): void {
  lastRendered.delete(guildId);
}

/**
 * Refresh one guild's board, posting it if there isn't one yet and editing it in
 * place otherwise. Entirely best-effort: a board that can't be updated must
 * never affect ticket handling.
 */
export async function refreshStatusBoard(
  guild: DiscordGuild,
  config: Guild,
): Promise<void> {
  if (!config.statusBoardChannelId) return;

  try {
    const tickets = await listOpenTicketsForBoard(guild.id);
    const groups = groupTicketsByCategory(tickets, (channelId) => {
      const parent = guild.channels.cache.get(channelId)?.parent;
      return parent ? { id: parent.id, name: parent.name } : null;
    });
    const embeds = buildStatusBoard(groups);

    // The "updated" timestamp changes every tick, so fingerprint the content
    // without it — otherwise nothing would ever compare equal.
    const fingerprint = JSON.stringify(
      groups.map((g) => [g.name, g.tickets.map(renderTicketRow)]),
    );
    if (lastRendered.get(guild.id) === fingerprint) return;

    const channel = await guild.channels
      .fetch(config.statusBoardChannelId)
      .catch(() => null);
    if (!channel?.isTextBased()) return;

    if (config.statusBoardMessageId) {
      const existing = await channel.messages
        .fetch(config.statusBoardMessageId)
        .catch(() => null);
      if (existing) {
        await existing.edit({ embeds });
        lastRendered.set(guild.id, fingerprint);
        return;
      }
      // Deleted by someone — fall through and post a replacement.
    }

    const posted = await channel.send({ embeds });
    await setStatusBoardMessage(guild.id, posted.id);
    lastRendered.set(guild.id, fingerprint);
  } catch (err) {
    console.error(`Status board refresh failed for ${guild.id}:`, err);
  }
}
