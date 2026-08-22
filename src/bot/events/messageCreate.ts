import type { Message } from "discord.js";

import {
  getTicket,
  markTicketActivityBy,
  upsertTicketMessages,
} from "@/lib/queries/tickets";
import { archiveMessageAttachments } from "../lib/attachment-archive";
import { messageToRow } from "../lib/message-snapshot";
import { getTrackedTicket } from "../lib/ticket-channels";

/**
 * Capture every message posted in an open ticket channel. Non-ticket channels
 * are rejected by a cheap in-memory lookup before any DB access.
 */
export async function onMessageCreate(message: Message): Promise<void> {
  const ticketId = getTrackedTicket(message.channelId);
  if (!ticketId) return;

  try {
    await upsertTicketMessages([messageToRow(message, ticketId)]);
    // Human messages reset the inactivity clock (bot posts — welcome, warnings,
    // canned responses — don't count, so an auto-close warning can't self-defer)
    // and flip who owes the next reply.
    if (!message.author.bot) {
      const ticket = await getTicket(ticketId);
      // The opener writing means staff owe a reply; anyone else means they do.
      const waitingOn =
        ticket && message.author.id === ticket.openerId ? "staff" : "user";
      await markTicketActivityBy(ticketId, message.createdAt, waitingOn);
    }
  } catch (err) {
    console.error("Failed to capture ticket message:", err);
    return;
  }

  // Archive any attachments off Discord's expiring CDN. Fire-and-forget so
  // capture latency doesn't depend on downloads; the close-time sweep is the
  // backstop if this misses.
  if (message.attachments.size > 0) {
    void archiveMessageAttachments(ticketId, message.id).catch((err) =>
      console.error("Failed to archive message attachments:", err),
    );
  }
}
