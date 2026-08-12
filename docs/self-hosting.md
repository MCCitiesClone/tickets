# Self-hosting

The recommended way to run Tickets is Docker Compose, which brings up three
services: **postgres**, **web**, and **bot** (plus a one-shot **migrate** job).

## Prerequisites

- Docker + Docker Compose v2
- A Discord application — see [discord-setup.md](discord-setup.md)

## Steps

```bash
# 1. Get the code
git clone <your-fork> tickets && cd tickets

# 2. Configure
cp .env.example .env
#   Edit .env and set at minimum:
#     DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
#     BETTER_AUTH_SECRET   (openssl rand -base64 32)
#   For a public deployment also set BETTER_AUTH_URL to your domain.

# 3. Build & start
docker compose up -d --build

# 4. Watch logs
docker compose logs -f web bot
```

Then open **http://localhost:3000** and sign in with Discord.

## What each service does

| Service    | Image target | Role                                                     |
| ---------- | ------------ | -------------------------------------------------------- |
| `postgres` | postgres:16  | Database + named volume `postgres-data`                  |
| `migrate`  | `bot`        | Runs `src/db/migrate.ts` once, then exits                |
| `web`      | `web`        | Next.js standalone dashboard on port 3000; serves archived attachments |
| `bot`      | `bot`        | discord.js gateway process; archives attachments to `attachment-data`  |

`web` and `bot` both wait for `migrate` to complete successfully
(`service_completed_successfully`) so the schema always exists before they run.

## Attachment archiving

Discord's attachment URLs are signed and expire, and deleting a closed ticket's
channel removes the originals — so transcripts would slowly rot into broken
links. To prevent that, the **bot downloads images and files sent in a ticket
into its own storage**, and the **web app serves them** on the transcript page
from a token-scoped URL (`/transcripts/<token>/attachments/<id>`).

Storage is a shared named volume, `attachment-data`, mounted into both `web` and
`bot` at `/data/attachments`. It persists across upgrades like `postgres-data`;
back it up alongside the database. Tune behaviour with these optional env vars
(defaults shown):

| Variable | Default | Meaning |
| --- | --- | --- |
| `ATTACHMENT_ARCHIVE_DIR` | `/data/attachments` (Docker) | Where archived files are stored/served. Both processes need the same path. |
| `ATTACHMENT_ARCHIVE_ENABLED` | `true` | Set `false` to keep the original (expiring) Discord URLs instead. |
| `ATTACHMENT_MAX_BYTES` | `26214400` | Skip archiving files larger than this (25 MiB); they keep their Discord URL. |

## Database credentials

Inside Compose, `DATABASE_URL` is assembled automatically from `POSTGRES_USER`,
`POSTGRES_PASSWORD`, and `POSTGRES_DB` and points at the internal `postgres`
host (the `DATABASE_URL` in `.env` is only used for non-Docker local dev). Change
the `POSTGRES_*` values in `.env` to set your own credentials.

## Pre-built images (GHCR)

Every release publishes `web` and `bot` images to the GitHub Container Registry,
so you can run without building locally via the `docker-compose.ghcr.yml`
override:

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

Images (`ghcr.io/mccitiesclone/tickets-web`, `ghcr.io/mccitiesclone/tickets-bot`)
are tagged by version (`x.y.z`, `x.y`) and `latest`. Pin a release with
`TICKETS_VERSION` (defaults to `latest`). Currently published for `linux/amd64`.

## Upgrading

```bash
git pull
docker compose up -d --build   # migrate re-runs and applies any new migrations
```

New schema changes ship as SQL files in `drizzle/` (generated with
`aube run db:generate`). The `migrate` service applies whatever is pending.

## Reverse proxy / TLS

Put the `web` service behind your reverse proxy (Caddy, nginx, Traefik) and
terminate TLS there. Set `BETTER_AUTH_URL` to the public HTTPS URL and add the
matching OAuth redirect (`https://your-domain/api/auth/callback/discord`) in the
Discord Developer Portal.

## Running without Docker

You can run the three pieces manually:

```bash
aube install
aube run db:migrate:run     # apply migrations to your Postgres
aube run build && aube run start   # web (or `aube run dev` for development)
aube run bot                # bot, in another process/terminal
```

## Troubleshooting

- **Bot online but commands missing** — global commands take time to propagate;
  set `DISCORD_DEV_GUILD_ID` and re-run `aube run bot:register <guildId>`.
- **Dashboard sign-in fails / redirect error** — the OAuth redirect URL in
  Discord must exactly match `BETTER_AUTH_URL` + `/api/auth/callback/discord`.
- **`migrate` service fails** — check `DATABASE_URL`/`POSTGRES_*` and that
  `postgres` became healthy (`docker compose ps`).
