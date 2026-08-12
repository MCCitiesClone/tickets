import type { Message } from "discord.js";

import { upsertTicketMessages } from "@/lib/queries/tickets";
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
  } catch (err) {
    console.error("Failed to capture ticket message:", err);
  }
}
