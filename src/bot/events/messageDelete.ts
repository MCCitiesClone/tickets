import type { Message, PartialMessage } from "discord.js";

import { markMessageDeleted } from "@/lib/queries/tickets";
import { getTrackedTicket } from "../lib/ticket-channels";

/**
 * Mark a captured ticket message as deleted. The ticket's channel is untracked
 * *before* it is deleted on close, so the bulk delete Discord fires for a
 * closing ticket never reaches here — only genuine user deletions do.
 */
export async function onMessageDelete(
  message: Message | PartialMessage,
): Promise<void> {
  const ticketId = getTrackedTicket(message.channelId);
  if (!ticketId) return;

  try {
    await markMessageDeleted(message.id, new Date());
  } catch (err) {
    console.error("Failed to record ticket message deletion:", err);
  }
}
