import type { Command } from "../types";
import { closeCommand } from "./close";
import { panelCommand } from "./panel";
import { pingCommand } from "./ping";
import { setupCommand } from "./setup";

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
];

/** Lookup by command name, used by the interaction handler. */
export const commandMap = new Map<string, Command>(
  commands.map((c) => [c.data.name, c]),
);
