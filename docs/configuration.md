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
server. Managed today via `/setup` and — increasingly — the dashboard.

| Field                 | Meaning                                                            |
| --------------------- | ----------------------------------------------------------------- |
| `guildId`             | Discord server snowflake (primary key).                           |
| `ticketCategoryId`    | Category new ticket channels are created under.                   |
| `transcriptChannelId` | Where closed-ticket transcripts are posted.                       |
| `logChannelId`        | Channel for audit/log messages (open, close, claim…).             |
| `staffRoleIds`        | Role IDs granted access to every ticket channel.                  |
| `welcomeMessage`      | First message posted inside a newly opened ticket.                |
| `ticketLimit`         | Max simultaneously-open tickets per user (`0` = unlimited).       |
| `namingScheme`        | Channel name template. `{number}` / `{username}` are substituted. |

Reads/writes go through the shared data layer in `src/lib/queries/guild.ts`
(`getGuild`, `upsertGuild`) so the web app and bot stay consistent.

## Other tables

- `panel` — ticket panels (button messages). See `src/db/schema/panels.ts`.
- `ticket` / `ticket_message` — tickets and archived transcript messages. See
  `src/db/schema/tickets.ts`.

The lifecycle that populates `ticket`/`ticket_message` is not implemented yet —
see [architecture.md](architecture.md) for where it plugs in.
