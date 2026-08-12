import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
} from "discord.js";

import {
  addBlacklistEntry,
  getBlacklistTarget,
  listGuildBlacklist,
  removeBlacklistTarget,
} from "@/lib/queries/blacklist";
import { upsertGuild } from "@/lib/queries/guild";
import type { Command } from "../types";
import { EMBED_COLOR, noticeEmbed } from "../lib/embeds";

/** Ephemeral reply helper for the command's own feedback. */
function reply(
  interaction: ChatInputCommandInteraction,
  content: string,
  color: number,
) {
  return interaction.reply({
    embeds: [noticeEmbed(content, color)],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * `/blacklist add|remove|list` — manage the users and roles blocked from opening
 * tickets in this server. Manage Server only; enforced in the open-ticket
 * precheck.
 */
export const blacklistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Block users or roles from opening tickets.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Block a user or role from opening tickets.")
        .addMentionableOption((o) =>
          o
            .setName("target")
            .setDescription("The user or role to block")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("reason")
            .setDescription("Why they're being blocked (optional)")
            .setMaxLength(500),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Unblock a user or role.")
        .addMentionableOption((o) =>
          o
            .setName("target")
            .setDescription("The user or role to unblock")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("Show the current blacklist."),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await reply(
        interaction,
        "You need the Manage Server permission to manage the blacklist.",
        EMBED_COLOR.danger,
      );
      return;
    }

    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === "list") {
      const entries = await listGuildBlacklist(guildId);
      if (entries.length === 0) {
        await reply(interaction, "The blacklist is empty.", EMBED_COLOR.info);
        return;
      }
      const lines = entries
        .slice(0, 25)
        .map((e) => {
          const who =
            e.targetType === "role" ? `<@&${e.targetId}>` : `<@${e.targetId}>`;
          return `• ${who}${e.reason ? ` — ${e.reason}` : ""}`;
        })
        .join("\n");
      const extra =
        entries.length > 25 ? `\n…and ${entries.length - 25} more.` : "";
      await interaction.reply({
        embeds: [
          noticeEmbed(`**Blacklist (${entries.length})**\n${lines}${extra}`, EMBED_COLOR.info),
        ],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const target = interaction.options.getMentionable("target", true);
    const isRole = target instanceof Role;
    const targetType = isRole ? "role" : "user";
    const mention = isRole ? `<@&${target.id}>` : `<@${target.id}>`;

    if (sub === "add") {
      const reason = interaction.options.getString("reason")?.trim() || null;

      if (await getBlacklistTarget(guildId, targetType, target.id)) {
        await reply(
          interaction,
          `${mention} is already blacklisted.`,
          EMBED_COLOR.danger,
        );
        return;
      }
      await upsertGuild(guildId);
      await addBlacklistEntry({
        guildId,
        targetType,
        targetId: target.id,
        reason,
        addedBy: interaction.user.username,
      });
      await interaction.reply({
        embeds: [
          noticeEmbed(
            `Blacklisted ${mention}${reason ? ` — ${reason}` : ""}. They can no longer open tickets.`,
            EMBED_COLOR.success,
          ),
        ],
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
      return;
    }

    // sub === "remove"
    const removed = await removeBlacklistTarget(guildId, targetType, target.id);
    await interaction.reply({
      embeds: [
        noticeEmbed(
          removed
            ? `Removed ${mention} from the blacklist.`
            : `${mention} wasn't on the blacklist.`,
          removed ? EMBED_COLOR.success : EMBED_COLOR.info,
        ),
      ],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
