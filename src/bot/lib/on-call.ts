import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Guild as DiscordGuild,
} from "discord.js";

import type { Guild } from "@/db/schema";
import { listActiveOnCall } from "@/lib/queries/on-call";
import { EMBED_COLOR } from "./embeds";

/** Who a fresh ticket needs to be surfaced to. */
export type OnCallTicket = {
  number: number;
  channelId: string;
  openerId: string;
  /** Panel the ticket came from, for context in the DM (null = no panel). */
  panelTitle: string | null;
};

/** Outcome of an on-call notification round, for the caller's audit log. */
export type OnCallNotifyResult = {
  /** Discord user IDs successfully DMed. */
  notified: string[];
  /** On-call members we couldn't reach (DMs closed, left the server, …). */
  failed: string[];
};

/**
 * Notify whoever is currently on call that a ticket just opened.
 *
 * This is a **direct message**, not a channel mention: the ticket channel's
 * welcome is deliberately just the embed and its controls (see the ghost-ping
 * removal in `openTicket`'s history), and a mention posted there would also land
 * in the transcript. A DM reaches the specific person holding the pager without
 * touching the ticket.
 *
 * Entirely best-effort — a member with DMs closed must never break the open.
 */
export async function notifyOnCallStaff(
  guild: DiscordGuild,
  config: Guild,
  ticket: OnCallTicket,
): Promise<OnCallNotifyResult> {
  const empty: OnCallNotifyResult = { notified: [], failed: [] };
  if (!config.onCallPingOnOpen) return empty;

  let roster;
  try {
    roster = await listActiveOnCall(guild.id);
  } catch (err) {
    console.error("Failed to load the on-call roster:", err);
    return empty;
  }
  if (roster.length === 0) return empty;

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR.info)
    .setTitle(`🛎️ Ticket #${ticket.number} opened in ${guild.name}`)
    .setDescription(
      `You're on call. <@${ticket.openerId}> just opened a ticket${
        ticket.panelTitle ? ` from **${ticket.panelTitle}**` : ""
      }.`,
    )
    .setTimestamp();

  const jump = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open ticket")
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/channels/${guild.id}/${ticket.channelId}`),
  );

  const result: OnCallNotifyResult = { notified: [], failed: [] };
  await Promise.all(
    roster.map(async ({ userId }) => {
      try {
        const user = await guild.client.users.fetch(userId);
        await user.send({ embeds: [embed], components: [jump] });
        result.notified.push(userId);
      } catch (err) {
        console.error(`Failed to DM on-call staff ${userId}:`, err);
        result.failed.push(userId);
      }
    }),
  );
  return result;
}
