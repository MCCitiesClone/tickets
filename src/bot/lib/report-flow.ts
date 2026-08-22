import {
  ActionRowBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageContextMenuCommandInteraction,
} from "discord.js";

import type { Panel } from "@/db/schema";
import { getGuild } from "@/lib/queries/guild";
import { listGuildPanels } from "@/lib/queries/panels";
import { EMBED_COLOR, noticeEmbed } from "./embeds";
import { openTicketFromPanel } from "./tickets";
import { toReportedMessage, type ReportedMessage } from "./report-message";

/**
 * Turning "report this message" into a ticket.
 *
 * Reporting has to land on *some* panel, since a panel is what decides the
 * category, staff roles and access rules. Which one is resolved in the least
 * annoying order: the configured report panel, then the guild's only panel, and
 * only if neither applies is the reporter asked.
 */

/** Panels a member could open a ticket from — disabled ones aren't offered. */
export function reportablePanels(panels: Panel[]): Panel[] {
  return panels.filter((p) => !p.disabled);
}

/**
 * The panel to report onto without asking, or null when the reporter must
 * choose. A configured panel wins even if there are others; falling back to a
 * lone panel means the common single-panel server needs no configuration.
 */
export function resolveReportPanel(
  panels: Panel[],
  configuredId: string | null,
): Panel | null {
  const usable = reportablePanels(panels);
  const configured = configuredId
    ? usable.find((p) => p.id === configuredId)
    : undefined;
  if (configured) return configured;
  return usable.length === 1 ? usable[0] : null;
}

/** Custom id prefix for the ephemeral "which panel?" select. */
export const REPORT_SELECT_PREFIX = "report_panel";

/** Discord caps a select at 25 options. */
const MAX_PANEL_OPTIONS = 25;

/** The ephemeral panel picker shown when the guild has several panels. */
export function buildReportPanelSelect(
  panels: Panel[],
  report: ReportedMessage,
): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(
        `${REPORT_SELECT_PREFIX}:${report.channelId}:${report.messageId}`,
      )
      .setPlaceholder("What kind of report is this?")
      .addOptions(
        reportablePanels(panels)
          .slice(0, MAX_PANEL_OPTIONS)
          .map((panel) =>
            new StringSelectMenuOptionBuilder()
              .setLabel((panel.buttonLabel || panel.title).slice(0, 100))
              .setValue(panel.id)
              .setDescription(panel.title.slice(0, 100)),
          ),
      ),
  );
}

/**
 * Entry point for the "Report message to staff" context-menu command.
 *
 * Everything after panel resolution goes through the normal open path, so
 * blacklists, access rules, cooldowns and per-user limits all apply exactly as
 * they do to a panel button — reporting must not be a way around them.
 */
export async function startMessageReport(
  interaction: MessageContextMenuCommandInteraction,
): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const report = toReportedMessage(interaction.targetMessage);

  if (interaction.targetMessage.author.id === interaction.user.id) {
    await interaction.reply({
      embeds: [
        noticeEmbed(
          "That's your own message — pick someone else's to report.",
          EMBED_COLOR.danger,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [config, panels] = await Promise.all([
    getGuild(interaction.guildId),
    listGuildPanels(interaction.guildId),
  ]);
  const usable = reportablePanels(panels);

  if (usable.length === 0) {
    await interaction.reply({
      embeds: [
        noticeEmbed(
          "This server has no ticket panels set up, so there's nowhere to send a report yet.",
          EMBED_COLOR.danger,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const panel = resolveReportPanel(panels, config?.reportPanelId ?? null);
  if (panel) {
    await openTicketFromPanel(interaction, panel.id, report);
    return;
  }

  // Several panels and no configured default — let the reporter choose. The
  // reply is ephemeral so a report never reveals itself in the channel.
  await interaction.reply({
    embeds: [
      noticeEmbed(
        "Which kind of ticket should this report open?",
        EMBED_COLOR.info,
      ),
    ],
    components: [buildReportPanelSelect(panels, report)],
    flags: MessageFlags.Ephemeral,
  });
}
