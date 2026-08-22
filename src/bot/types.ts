import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

/** A slash command: its definition (for registration) plus its handler. */
export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
  /** Optional handler for option autocomplete (for options with autocomplete). */
  autocomplete?: (
    interaction: AutocompleteInteraction,
  ) => Promise<void> | void;
}

/**
 * A message context-menu command — the "Apps" entry shown when right-clicking a
 * message. Registered alongside slash commands but dispatched separately, since
 * Discord allows a context menu and a slash command to share a name.
 */
export interface MessageCommand {
  data: ContextMenuCommandBuilder;
  execute: (
    interaction: MessageContextMenuCommandInteraction,
  ) => Promise<void> | void;
}
