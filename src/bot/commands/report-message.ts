import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
} from "discord.js";

import type { MessageCommand } from "../types";
import { startMessageReport } from "../lib/report-flow";

/**
 * "Report message to staff" — the Apps entry on a message's right-click menu.
 *
 * Opens a ticket with the reported message quoted into it, so staff see what
 * was said even if the original is deleted straight afterwards.
 */
export const reportMessageCommand: MessageCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Report message to staff")
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false),
  execute: startMessageReport,
};
