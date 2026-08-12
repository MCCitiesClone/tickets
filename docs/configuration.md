# Configuration reference

## Environment variables

Defined and validated in `src/lib/env.ts` (via Zod). Startup fails fast with a
readable message if any required value is missing or malformed.

| Variable                | Required | Used by   | Description                                                                 |
| ----------------------- | :------: | --------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`          | ✅       | web, bot  | Postgres connection string. In Docker it's derived from `POSTGRES_*`.       |
| `DISCORD_TOKEN`         | ✅       | bot       | Bot token from the Developer Portal → Bot.                                  |
| `DISCORD_CLIENT_ID`     | ✅       | web, bot  | Application ID. Used for the invite URL and command registration.           |
| `DISCORD_CLIENT_SECRET` | ✅       | web       | OAuth2 client secret for dashboard sign-in.                                 |
| `BETTER_AUTH_SECRET`    | ✅       | web       | Session-signing secret. `openssl rand -base64 32`.                          |
| `BETTER_AUTH_URL`       | ➖       | web       | Public dashboard URL. Defaults to `http://localhost:3000`.                  |
| `DISCORD_DEV_GUILD_ID`  | ➖       | bot       | If set, slash commands register to this guild (instant) instead of global.  |
| `POSTGRES_USER/PASSWORD/DB` | ➖   | compose   | Credentials for the Compose `postgres` service.                            |
| `SKIP_ENV_VALIDATION`   | ➖       | build     | Set during `next build` to skip validation (no real secrets needed).        |

## Guild (per-server) configuration

Stored in the `guild` table (`src/db/schema/guilds.ts`), one row per Discord
server. Configured through the **web dashboard**: sign in, open **Settings**,
pick a server you manage (you need Manage Server and the bot must be present),
and edit its config there. The `/setup` slash command just links you to that
page. Saving in the dashboard creates/updates the row.

| Field                  | Meaning                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| `guildId`              | Discord server snowflake (primary key).                           |
| `ticketCategoryId`     | Category new ticket channels are created under.                   |
| `transcriptChannelId`  | Where closed-ticket transcript links are posted.                  |
| `dmTranscriptOnClose`  | DM the opener the transcript link on close (default off).         |
| `logChannelId`         | Channel for audit/log messages (open, close, claim, rename…).     |
| `staffRoleIds`         | Role IDs granted access to every ticket channel.                  |
| `welcomeMessage`       | Plain-text first message (used when no rich welcome template set).|
| `messageTemplates`     | Rich embed templates: welcome, claim, close DM, transcript post.  |
| `ticketLimit`          | Max simultaneously-open tickets per user (`0` = unlimited; default `1`). |
| `namingScheme`         | Channel name template. `{number}` / `{username}` are substituted. |
| `ticketCounter`        | Atomic per-guild counter that assigns each ticket its number.     |

Reads/writes go through the shared data layer in `src/lib/queries/guild.ts`
(`getGuild`, `upsertGuild`) so the web app and bot stay consistent.

## Other tables

- `panel` / `multi_panel` — ticket panels and grouped panels (button messages).
  See `src/db/schema/panels.ts`.
- `panel_cooldown` — per-user, per-panel cooldown expiry.
- `ticket` — one row per ticket (number, channel, opener, status, claim, close
  request, form responses). See `src/db/schema/tickets.ts`.
- `ticket_message` — captured messages that make up a transcript.
- `transcript` — the shareable transcript record (token, message count, reason).

The full ticket lifecycle populates these tables end to end — see
[architecture.md](architecture.md). Full documentation of every feature lives in
the in-app docs at `/docs` (source under `src/app/docs/`).
