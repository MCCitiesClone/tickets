# Architecture

## Two processes, one database

Tickets is a single repository that produces **two runtime processes** sharing
one Postgres database through a common Drizzle layer:

1. **Web** (`next start` / `src/app`) — the dashboard and Better-Auth. Built as a
   Next.js **standalone** server.
2. **Bot** (`tsx src/bot/index.ts`) — the discord.js gateway connection.

```
src/
├── app/                     # Next.js App Router (web)
│   ├── (auth)/sign-in/      #   Discord sign-in
│   ├── (dashboard)/         #   session-guarded dashboard + sidebar
│   ├── actions/guild.ts     #   'use server' mutations (session-verified)
│   └── api/auth/[...all]/    #   Better-Auth catch-all handler
├── bot/                     # discord.js process
│   ├── index.ts             #   entry: loads env, logs in
│   ├── commands/            #   slash-command registry (ping/setup/panel)
│   ├── events/              #   ready + interactionCreate routing
│   └── lib/register-commands.ts
├── db/                      # SHARED: Drizzle schema + client + migrations
│   ├── schema/              #   auth, guilds, panels, tickets
│   ├── index.ts             #   pg Pool + drizzle client
│   └── migrate.ts           #   programmatic migrator (Docker migrate step)
├── lib/
│   ├── env.ts               #   SHARED: zod-validated env
│   ├── auth.ts              #   Better-Auth server config
│   ├── queries/            #   SHARED: guild/ticket/panel data access
│   ├── discord.ts           #   bot invite URL builder
│   ├── discord-api.ts       #   Discord REST reads (bot + user guilds, channels, roles)
│   └── guild-access.ts      #   which servers a user may configure (authz)
└── proxy.ts                 # optimistic dashboard auth gate (Next "middleware")
```

## Configuration is web-based

All per-server configuration happens in the dashboard (**Settings**), not in
Discord. A user may configure a server only when the bot is in it **and** they
have Manage Server there — computed in `src/lib/guild-access.ts` by intersecting
the bot's guilds (bot token) with the user's manageable guilds (their Discord
OAuth token). The `/setup` command is just a deep link to that page, and the
`updateGuildConfig` server action re-checks this authorization on every save.

## Why the bot is a separate process

A Discord gateway connection must be **single and long-lived**. Running it
inside Next.js (e.g. via `instrumentation.ts`) breaks under dev HMR, doesn't
survive serverless, and would open duplicate gateway connections if the web app
scaled horizontally. A dedicated process is also a clean, independently
restartable Docker container.

## Request/auth flow (web)

1. `proxy.ts` does a cheap cookie check and redirects signed-out users away from
   `/dashboard/*` (optimistic only — **not** a security boundary).
2. The dashboard layout and every server action call `requireSession()`
   (`src/lib/session.ts`), which is the real check.
3. Better-Auth stores sessions/accounts in the same Postgres DB via the Drizzle
   adapter.

## Notes for this Next.js build

This repo pins a customized Next.js 16 (see `AGENTS.md`). Conventions the code
follows and you should too:

- `params` / `searchParams` / `cookies()` / `headers()` are **async** — await
  them.
- Middleware is renamed to **`proxy.ts`**.
- `output: "standalone"` is set for slim Docker images.
- Read `node_modules/next/dist/docs/` before adding framework features.

## The ticket lifecycle

Implemented in `src/bot/lib/tickets.ts`, routed from
`src/bot/events/interactionCreate.ts`:

- **Opening** (`open_ticket:<panelId>` button) — loads guild config, enforces
  `ticketLimit`, atomically assigns the next per-guild `number`
  (`nextTicketNumber` → `guild.ticket_counter`), creates a private channel under
  `ticketCategoryId` with overwrites for the opener + `staffRoleIds`, inserts a
  `ticket` row, and posts `welcomeMessage` with a Close button.
- **Panels** — created in the dashboard (`/dashboard/panels`). The
  `createPanel` server action persists a `panel` row and posts the embed + button
  via the bot REST API (`postPanelMessage`), storing the `messageId`.
- **Claiming** (`claim_ticket`/`unclaim_ticket` buttons or `/claim` `/unclaim`)
  — staff assign/release a ticket; `ticket.claimedBy` is updated and the opening
  message's buttons swap between Claim/Release.
- **Members** (`/add` `/remove`) — opener or staff grant/revoke a member's access
  to the ticket channel via permission overwrites.
- **Closing** (`close_ticket:<ticketId>` button or `/close [reason]`) —
  authorizes (opener / staff role / Manage Channels), builds a transcript from
  the channel's messages, posts it to `transcriptChannelId`, flips
  `ticket.status` to closed, and deletes the channel.

Lifecycle events (open, claim, release, close) are also written to the
configured `logChannelId` for an audit trail.

**Transcript caveat:** message text is fetched via the bot REST API. Full
content requires the **Message Content** privileged intent enabled for your app
in the Developer Portal; without it, message bodies may come back empty. The
gateway client intentionally does **not** request that intent by default (doing
so would block login until it's enabled), so enable it in the portal if you want
complete transcripts.

Still additive from here (schema already models them): claiming (`ticket.claimedBy`),
tags, blacklist, and persisting messages into `ticket_message` for an in-dashboard
transcript viewer.
