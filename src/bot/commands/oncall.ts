import {
  type ChatInputCommandInteraction,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";

import type { Guild } from "@/db/schema";
import { getGuild, upsertGuild } from "@/lib/queries/guild";
import {
  getOnCallEntry,
  listOnCall,
  removeOnCallEntry,
  upsertOnCallEntry,
} from "@/lib/queries/on-call";
import type { Command } from "../types";
import { EMBED_COLOR, noticeEmbed } from "../lib/embeds";
import { isStaffMember } from "../lib/staff";

/** Ephemeral reply helper — on-call chatter shouldn't clutter the channel. */
function reply(
  interaction: ChatInputCommandInteraction,
  content: string,
  color: number,
) {
  return interaction.reply({
    embeds: [noticeEmbed(content, color)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

/** Roster line: 🟢 for whoever's holding the pager, ⚪ for the rest. */
function rosterLine(entry: {
  userId: string;
  active: boolean;
  note: string | null;
}): string {
  const note = entry.note ? ` — ${entry.note}` : "";
  return `${entry.active ? "🟢" : "⚪"} <@${entry.userId}>${note}`;
}

/**
 * `/oncall list|claim|release|add|remove` — manage who's holding the pager.
 *
 * Staff take and hand off duty themselves (`claim` / `release`, which enroll
 * automatically); managers curate the roster (`add` / `remove`). When a ticket
 * opens, everyone marked on call is DMed — see `notifyOnCallStaff`.
 */
export const onCallCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("oncall")
    .setDescription("See or change who's on call for tickets.")
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .setDMPermission(false)
    .addSubcommand((s) =>
      s.setName("list").setDescription("Show the on-call roster."),
    )
    .addSubcommand((s) =>
      s
        .setName("claim")
        .setDescription("Go on call. Adds you to the roster if you're not on it.")
        .addStringOption((o) =>
          o
            .setName("note")
            .setDescription('Shown beside you, e.g. "until 17:00 UTC"')
            .setMaxLength(100),
        ),
    )
    .addSubcommand((s) =>
      s.setName("release").setDescription("Hand off — stop being on call."),
    )
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a staff member to the roster (off call).")
        .addUserOption((o) =>
          o
            .setName("user")
            .setDescription("The staff member to add")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove someone from the roster entirely.")
        .addUserOption((o) =>
          o
            .setName("user")
            .setDescription("The staff member to remove")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (!interaction.inCachedGuild()) return;
    const { guildId, member } = interaction;
    const sub = interaction.options.getSubcommand();

    const config: Guild | null = await getGuild(guildId);
    if (!config) {
      await reply(
        interaction,
        "This server isn't configured yet — run `/setup` first.",
        EMBED_COLOR.danger,
      );
      return;
    }
    if (!isStaffMember(member, config)) {
      await reply(
        interaction,
        "Only staff can see or change the on-call roster.",
        EMBED_COLOR.danger,
      );
      return;
    }

    if (sub === "list") {
      const roster = await listOnCall(guildId);
      if (roster.length === 0) {
        await reply(
          interaction,
          "Nobody is on the roster yet. Use `/oncall claim` to take the pager.",
          EMBED_COLOR.info,
        );
        return;
      }
      const active = roster.filter((r) => r.active);
      const lines = roster.slice(0, 25).map(rosterLine).join("\n");
      const extra =
        roster.length > 25 ? `\n…and ${roster.length - 25} more.` : "";
      const heading =
        active.length === 0
          ? "**Nobody is on call right now**"
          : `**On call now: ${active.length}**`;
      await reply(
        interaction,
        `${heading}\n${lines}${extra}`,
        active.length === 0 ? EMBED_COLOR.danger : EMBED_COLOR.info,
      );
      return;
    }

    if (sub === "claim") {
      const note = interaction.options.getString("note")?.trim() || null;
      await upsertGuild(guildId);
      await upsertOnCallEntry({
        guildId,
        userId: interaction.user.id,
        active: true,
        note,
        updatedBy: interaction.user.username,
      });
      await reply(
        interaction,
        `🟢 You're on call${note ? ` — ${note}` : ""}. You'll be DMed when a ticket opens.`,
        EMBED_COLOR.success,
      );
      return;
    }

    if (sub === "release") {
      const entry = await getOnCallEntry(guildId, interaction.user.id);
      if (!entry?.active) {
        await reply(interaction, "You're not on call.", EMBED_COLOR.info);
        return;
      }
      await upsertOnCallEntry({
        guildId,
        userId: interaction.user.id,
        active: false,
        updatedBy: interaction.user.username,
      });
      await reply(
        interaction,
        "⚪ You're off call. You're still on the roster.",
        EMBED_COLOR.success,
      );
      return;
    }

    // `add` / `remove` curate the roster for other people — managers only.
    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await reply(
        interaction,
        "You need the Manage Server permission to change someone else's roster entry.",
        EMBED_COLOR.danger,
      );
      return;
    }
    const target = interaction.options.getUser("user", true);

    if (sub === "add") {
      if (target.bot) {
        await reply(interaction, "Bots can't be on call.", EMBED_COLOR.danger);
        return;
      }
      if (await getOnCallEntry(guildId, target.id)) {
        await reply(
          interaction,
          `<@${target.id}> is already on the roster.`,
          EMBED_COLOR.info,
        );
        return;
      }
      await upsertGuild(guildId);
      await upsertOnCallEntry({
        guildId,
        userId: target.id,
        active: false,
        updatedBy: interaction.user.username,
      });
      await reply(
        interaction,
        `Added <@${target.id}> to the roster. They can take the pager with \`/oncall claim\`.`,
        EMBED_COLOR.success,
      );
      return;
    }

    // sub === "remove"
    const removed = await removeOnCallEntry(guildId, target.id);
    await reply(
      interaction,
      removed
        ? `Removed <@${target.id}> from the roster.`
        : `<@${target.id}> isn't on the roster.`,
      removed ? EMBED_COLOR.success : EMBED_COLOR.info,
    );
  },
};
