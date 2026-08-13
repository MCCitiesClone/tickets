import { DEFAULT_PANEL_COLOR, type MessageTemplate } from "@/db/schema";

/**
 * A starter template an admin can drop into the embed editor instead of
 * building a message from a blank slate. Presets use the same `{placeholder}`
 * tokens the bot substitutes at send time, so they render correctly as-is.
 */
export type EmbedPreset = {
  label: string;
  description: string;
  template: MessageTemplate;
};

const BRAND = DEFAULT_PANEL_COLOR;
const GREEN = 0x57f287;
const RED = 0xed4245;

/**
 * Presets offered in every context. Neutral starting points that don't assume
 * any particular token is available.
 */
export const SHARED_PRESETS: EmbedPreset[] = [
  {
    label: "Simple announcement",
    description: "A title and a paragraph of text.",
    template: {
      embeds: [
        {
          title: "Announcement",
          description: "Write your announcement here.",
          color: BRAND,
        },
      ],
    },
  },
  {
    label: "Branded card",
    description: "Title, description, and a footer with the server name.",
    template: {
      embeds: [
        {
          title: "Heading",
          description: "Supporting text goes here.",
          color: BRAND,
          footer: { text: "{server}" },
        },
      ],
    },
  },
];

/**
 * Context-specific starters, keyed to match how each editor is used. Each one
 * leans on the tokens available in that context.
 */
export const PRESETS: Record<string, EmbedPreset[]> = {
  welcome: [
    {
      label: "Friendly welcome",
      description: "Greets the opener and sets expectations.",
      template: {
        embeds: [
          {
            title: "Thanks for reaching out 👋",
            description:
              "Hi {user}, thanks for opening a ticket. A member of our team will be with you shortly — please describe your issue in as much detail as you can.",
            color: BRAND,
            footer: { text: "Ticket #{number} • {server}" },
          },
        ],
      },
    },
    {
      label: "Support checklist",
      description: "Asks the opener for the details staff usually need.",
      template: {
        embeds: [
          {
            title: "Welcome to your ticket",
            description:
              "To help us resolve this quickly, please include:",
            color: BRAND,
            fields: [
              { name: "What happened?", value: "A short summary of the issue." },
              { name: "When did it start?", value: "Date/time if you know it." },
              { name: "Anything else?", value: "Screenshots or links help a lot." },
            ],
          },
        ],
      },
    },
  ],
  claimNotice: [
    {
      label: "Claimed by staff",
      description: "Tells the opener who is helping them.",
      template: {
        embeds: [
          {
            title: "Ticket claimed",
            description:
              "{claimer} has claimed this ticket and will be helping you from here.",
            color: GREEN,
          },
        ],
      },
    },
  ],
  closeDm: [
    {
      label: "Ticket closed summary",
      description: "DMs the opener with the reason and a transcript link.",
      template: {
        embeds: [
          {
            title: "Your ticket was closed",
            description:
              "Your ticket in **{server}** has been closed. If you still need help, feel free to open a new one.",
            color: RED,
            fields: [
              { name: "Reason", value: "{reason}" },
              { name: "Transcript", value: "[View transcript]({transcript_url})" },
            ],
          },
        ],
      },
    },
  ],
  transcriptPost: [
    {
      label: "Transcript log entry",
      description: "A compact record posted to your transcript channel.",
      template: {
        embeds: [
          {
            title: "Ticket #{number} closed",
            color: BRAND,
            fields: [
              { name: "Opened by", value: "{opener}", inline: true },
              { name: "Closed by", value: "{closer}", inline: true },
              { name: "Reason", value: "{reason}" },
              { name: "Transcript", value: "[Open]({transcript_url})" },
            ],
          },
        ],
      },
    },
  ],
  cannedResponse: [
    {
      label: "Need more info",
      description: "Asks the member for additional detail.",
      template: {
        embeds: [
          {
            title: "We need a little more information",
            description:
              "Could you share some more detail so we can help? Screenshots, error messages, or steps to reproduce are all useful.",
            color: BRAND,
          },
        ],
      },
    },
    {
      label: "Resolved",
      description: "Confirms the issue is resolved before closing.",
      template: {
        embeds: [
          {
            title: "Glad we could help ✅",
            description:
              "It looks like this is resolved. We'll close the ticket shortly — reply here if you need anything else.",
            color: GREEN,
          },
        ],
      },
    },
  ],
  panelWelcome: [
    {
      label: "Friendly welcome",
      description: "Greets the opener when their ticket opens.",
      template: {
        embeds: [
          {
            title: "Thanks for reaching out 👋",
            description:
              "Hi {user}, thanks for opening a ticket. A member of our team will be with you shortly — please describe your issue in as much detail as you can.",
            color: BRAND,
            footer: { text: "Ticket #{number} • {server}" },
          },
        ],
      },
    },
  ],
};

/** Shared presets plus the context-specific set for `key` (if any). */
export function presetsFor(key?: string): EmbedPreset[] {
  const specific = key ? (PRESETS[key] ?? []) : [];
  return [...specific, ...SHARED_PRESETS];
}
