import type { Command } from "../types";
import { claimCommand, unclaimCommand } from "./claim";
import { closeCommand } from "./close";
import { addCommand, removeCommand } from "./members";
import { panelCommand } from "./panel";
import { pingCommand } from "./ping";
import { renameCommand } from "./rename";
import { setupCommand } from "./setup";
import { switchPanelCommand } from "./switchpanel";

/**
 * The command registry. Add new commands here — this single list is the source
 * of truth for both runtime dispatch (`interactionCreate`) and registration
 * with Discord (`register-commands.ts`). An explicit array (rather than fs
 * globbing) keeps command loading predictable under tsx and when bundled.
 */
export const commands: Command[] = [
  pingCommand,
  setupCommand,
  panelCommand,
  closeCommand,
  claimCommand,
  unclaimCommand,
  addCommand,
  removeCommand,
  renameCommand,
  switchPanelCommand,
];

/** Lookup by command name, used by the interaction handler. */
export const commandMap = new Map<string, Command>(
  commands.map((c) => [c.data.name, c]),
);
