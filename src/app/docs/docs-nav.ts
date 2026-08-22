/**
 * Ordered navigation for the in-app documentation. Each entry maps a doc page
 * (an `.mdx` file under this directory) to its sidebar label. Kept in one place
 * so the sidebar, "next/previous" footer, and any table of contents stay in
 * sync. Add a page by creating `docs/<slug>/page.mdx` and listing it here.
 */
export type DocLink = {
  title: string;
  href: string;
};

export type DocSection = {
  title: string;
  links: DocLink[];
};

export const docsNav: DocSection[] = [
  {
    title: "Getting started",
    links: [
      { title: "Introduction", href: "/docs" },
      { title: "Quickstart & self-hosting", href: "/docs/self-hosting" },
      { title: "Discord application setup", href: "/docs/discord-setup" },
      { title: "Configuration", href: "/docs/configuration" },
    ],
  },
  {
    title: "Features",
    links: [
      { title: "Ticket lifecycle", href: "/docs/tickets" },
      { title: "Ratings & feedback", href: "/docs/feedback" },
      { title: "Stats & analytics", href: "/docs/stats" },
      { title: "Panels & forms", href: "/docs/panels" },
      { title: "Message templates", href: "/docs/messages" },
      { title: "Canned responses", href: "/docs/canned-responses" },
      { title: "On-call staff", href: "/docs/on-call" },
      { title: "Blacklist", href: "/docs/blacklist" },
      { title: "Slash commands", href: "/docs/commands" },
    ],
  },
  {
    title: "Reference",
    links: [{ title: "Architecture", href: "/docs/architecture" }],
  },
];

/** Flattened, in-order list of every doc page — used for prev/next links. */
export const docsFlat: DocLink[] = docsNav.flatMap((section) => section.links);
