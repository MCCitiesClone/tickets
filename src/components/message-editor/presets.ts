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
const ORANGE = 0xfaa61a;
const GREY = 0x99aab5;

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
  {
    label: "Info notice",
    description: "A neutral, informational callout.",
    template: {
      embeds: [
        {
          title: "ℹ️ Heads up",
          description: "Something worth knowing goes here.",
          color: GREY,
        },
      ],
    },
  },
  {
    label: "Warning",
    description: "An orange caution banner.",
    template: {
      embeds: [
        {
          title: "⚠️ Please note",
          description: "Describe the caution or important condition here.",
          color: ORANGE,
        },
      ],
    },
  },
  {
    label: "Success",
    description: "A green confirmation banner.",
    template: {
      embeds: [
        {
          title: "✅ All set",
          description: "Confirm what just happened here.",
          color: GREEN,
        },
      ],
    },
  },
  {
    label: "Info list",
    description: "A card with a few labelled fields.",
    template: {
      embeds: [
        {
          title: "Overview",
          color: BRAND,
          fields: [
            { name: "First", value: "Detail", inline: true },
            { name: "Second", value: "Detail", inline: true },
            { name: "Third", value: "Detail" },
          ],
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
    {
      label: "Minimal welcome",
      description: "A short, no-frills greeting.",
      template: {
        content: "Thanks for opening a ticket, {user} — we'll be right with you.",
        embeds: [],
      },
    },
    {
      label: "Welcome with rules",
      description: "Greets the opener and lists a few ground rules.",
      template: {
        embeds: [
          {
            title: "Thanks for reaching out 👋",
            description:
              "Hi {user}! While you wait, a few quick things to keep support smooth:",
            color: BRAND,
            fields: [
              { name: "Be specific", value: "The more detail, the faster we can help." },
              { name: "Be patient", value: "Staff are notified and will reply soon." },
              { name: "Stay on topic", value: "One issue per ticket, please." },
            ],
            footer: { text: "Ticket #{number} • {server}" },
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
    {
      label: "Assigned (compact)",
      description: "A single line of content, no embed.",
      template: {
        content: "🙋 {claimer} has claimed this ticket and is now assisting you.",
        embeds: [],
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
    {
      label: "Closed + thanks",
      description: "A warmer close with a thank-you.",
      template: {
        embeds: [
          {
            title: "Thanks for contacting us 💙",
            description:
              "Your ticket in **{server}** is now closed. We hope we could help! Reply or open a new ticket any time.",
            color: BRAND,
            footer: { text: "A transcript is available on request." },
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
    {
      label: "Transcript (one line)",
      description: "A single-line log entry with a link.",
      template: {
        content:
          "📄 Ticket #{number} closed by {closer} — [transcript]({transcript_url})",
        embeds: [],
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
    {
      label: "On our way",
      description: "Lets the member know someone is looking into it.",
      template: {
        content:
          "👀 Thanks for your patience — a member of our team is looking into this now.",
        embeds: [],
      },
    },
    {
      label: "Escalated",
      description: "Tells the member their issue was escalated.",
      template: {
        embeds: [
          {
            title: "Escalated to our team",
            description:
              "We've escalated this to the relevant team. We'll update you here as soon as we hear back — thanks for waiting.",
            color: ORANGE,
          },
        ],
      },
    },
    {
      label: "Closing soon",
      description: "Warns the member the ticket will close if idle.",
      template: {
        embeds: [
          {
            title: "Anything else?",
            description:
              "We'll close this ticket soon if there's nothing further. Just reply here if you still need help!",
            color: GREY,
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
    {
      label: "Support checklist",
      description: "Asks the opener for the details staff usually need.",
      template: {
        embeds: [
          {
            title: "Welcome to your ticket",
            description: "To help us resolve this quickly, please include:",
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
};

/** Shared presets plus the context-specific set for `key` (if any). */
export function presetsFor(key?: string): EmbedPreset[] {
  const specific = key ? (PRESETS[key] ?? []) : [];
  return [...specific, ...SHARED_PRESETS];
}
