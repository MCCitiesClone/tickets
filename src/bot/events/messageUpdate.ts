import type { Message, PartialMessage } from "discord.js";

import { markMessageEdited } from "@/lib/queries/tickets";
import { getTrackedTicket } from "../lib/ticket-channels";

/**
 * Record content edits to captured ticket messages. discord.js also fires this
 * for non-edit updates (e.g. a link's embed resolving); we ignore those by
 * checking for an actual `editedAt` timestamp.
 */
export async function onMessageUpdate(
  _oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
): Promise<void> {
  const ticketId = getTrackedTicket(newMessage.channelId);
  if (!ticketId) return;

  try {
    const message = newMessage.partial ? await newMessage.fetch() : newMessage;
    if (!message.editedAt) return;
    await markMessageEdited(message.id, message.content ?? "", message.editedAt);
  } catch (err) {
    console.error("Failed to record ticket message edit:", err);
  }
}
