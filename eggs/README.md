# Pterodactyl / Pelican egg

[`egg-tickets.json`](egg-tickets.json) runs the **Tickets bot** on a
[Pterodactyl](https://pterodactyl.io) or [Pelican](https://pelican.dev) panel.

One file covers both: Pelican reads the same `PTDL_v2` egg format, so import it
into either panel unchanged.

## What this egg does and doesn't do

It runs the **bot process only** — the gateway client that creates ticket
channels, captures transcripts and handles slash commands. It does **not** run:

- **PostgreSQL.** Point `DATABASE_URL` at a database you already host. Panel
  "Databases" provision MySQL, which this project doesn't support.
- **The web dashboard.** Host it separately (Docker, a Node host, anywhere) and
  point it at the *same* `DATABASE_URL`. Without it there's no UI for panels,
  settings, stats or transcript pages — the bot alone isn't configurable.

The bot applies its own **migrations on every start**, so a fresh database is
set up automatically and updates carry their schema changes with them.

## Importing

1. **Admin → Eggs → Import Egg**, upload `egg-tickets.json` (or paste its raw
   GitHub URL), and pick a nest.
2. Create a server using it. Give it ~1 GB RAM and a couple of GB of disk;
   installation clones the repo and runs `npm ci`, which is the bulk of it.
3. Fill in the variables below and start it.

An allocation (IP/port) is required by the panel but never used — the bot only
makes outbound connections to Discord and PostgreSQL.

## Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/tickets`. Must be reachable from the node, and shared with the dashboard. |
| `DISCORD_TOKEN` | ✅ | Bot token. **Enable the Message Content intent** on the Bot page — transcripts need it. |
| `DISCORD_CLIENT_ID` | ✅ | Application ID; used to register slash commands. |
| `DISCORD_CLIENT_SECRET` | ✅ | The bot signs nobody in, but it shares one config schema with the dashboard. |
| `BETTER_AUTH_SECRET` | ✅ | 32+ random characters, identical to the dashboard's. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✅ | Public dashboard URL — the bot builds transcript links from it. |
| `DISCORD_DEV_GUILD_ID` | — | Register commands to one server for instant updates while testing. Empty = global (up to an hour to propagate). |
| `ATTACHMENT_ARCHIVE_DIR` | — | Default `.data/attachments`, inside the server directory. |
| `ATTACHMENT_ARCHIVE_ENABLED` | — | `false` keeps Discord's expiring CDN URLs instead of archiving. |
| `ATTACHMENT_MAX_BYTES` | — | Skip archiving files bigger than this. Default 25 MiB. |
| `GIT_REPO` / `GIT_REF` | — | Source cloned at install. Change to track a fork or a tag. |

See [docs/configuration.md](../docs/configuration.md) for what each one means in
depth.

## Updating

Press **Reinstall**. The script fetches `GIT_REF` and hard-resets to it, keeping
`node_modules`, `.data` (archived attachments) and any `.env` you added. New
migrations apply on the next start.

## Attachments

The dashboard serves archived attachments from `ATTACHMENT_ARCHIVE_DIR`, so it
needs to read the same files the bot writes. Split across two hosts, either share
that directory between them or set `ATTACHMENT_ARCHIVE_ENABLED=false` and accept
that Discord's CDN links in old transcripts eventually expire.

## Troubleshooting

**Stops immediately with an env error** — the message names every missing or
malformed variable. `DATABASE_URL` and `BETTER_AUTH_URL` must be valid URLs.

**"Migration failed" on boot** — the bot runs `drizzle` migrations at start. A
database first created with `db:push` (rather than migrations) has no migration
history and will conflict; point the egg at a fresh database, or apply the
history manually.

**Console shows no "Logged in as"** — the panel marks the server started on that
line. If it never appears, the token is wrong or the node can't reach Discord.
