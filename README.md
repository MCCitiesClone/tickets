# 🎫 Tickets

A self-hostable **Discord support-ticket bot** with a companion **web dashboard**
for configuration and management. Inspired by
[discord-tickets/bot](https://github.com/discord-tickets/bot) and
[TicketsBot](https://github.com/orgs/TicketsBot-cloud/repositories) — built to be
easy to run yourself and to own your own data.

> **Status: early but functional.** Configuration, panels, and the core ticket
> lifecycle (open → staff reply → close → transcript) work end to end. Claiming,
> tags, blacklist, and in-dashboard stats/transcript viewing are still to come —
> see the [roadmap](#roadmap).

---

## Features

- **Channel-based tickets** — each ticket is a private channel under a category,
  with per-user and staff-role permission overwrites, a per-user open limit, and
  configurable channel naming.
- **Panels** — create button messages in the dashboard; members click to open a
  ticket. Tickets close with a button or `/close`, posting a transcript.
- **Panel forms** — optionally attach up to 5 questions to a panel; clicking it
  opens a native Discord modal, and the answers are saved and posted in the
  ticket.
- **Web dashboard** — sign in with Discord and configure your servers from a
  browser (built with Next.js + shadcn/ui). All config is web-based.
- **Ticket management** — staff can `/claim` and `/unclaim` tickets (also via
  buttons), `/add` and `/remove` members, and `/close [reason]`. Lifecycle
  events are logged to a configurable log channel.
- **Slash commands** — `/ping`, `/close`, `/claim`, `/unclaim`, `/add`,
  `/remove`; `/setup` and `/panel` link to the dashboard.
- **Self-hostable** — one `docker compose up` brings up Postgres, the web app,
  and the bot. Your data stays on your infrastructure.

## Tech stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Web framework  | Next.js 16 (App Router)                  |
| UI             | shadcn/ui + Tailwind CSS                 |
| Auth           | Better-Auth (Discord OAuth)              |
| Database / ORM | PostgreSQL + Drizzle ORM                 |
| Bot            | discord.js 14 (standalone Node process)  |
| Package manager| [aube](https://github.com/) (`aube run`) |

## Architecture

Two processes share one Postgres database through a common Drizzle layer:

```
                ┌───────────────┐        ┌──────────────┐
  Browser  ───▶ │  web (Next.js)│        │ bot (disc.js)│ ◀─── Discord Gateway
                │  dashboard +  │        │  slash cmds, │
                │  Better-Auth  │        │  tickets     │
                └──────┬────────┘        └──────┬───────┘
                       │   shared src/db (Drizzle) │
                       └───────────┬───────────────┘
                                   ▼
                            ┌────────────┐
                            │ PostgreSQL │
                            └────────────┘
```

The bot runs as its **own process** (not inside Next.js) because a Discord
gateway must be a single long-lived connection. See
[docs/architecture.md](docs/architecture.md).

## Quickstart (Docker)

```bash
git clone <your-fork> tickets && cd tickets
cp .env.example .env
# Fill in DISCORD_* and BETTER_AUTH_SECRET — see docs/discord-setup.md
docker compose up -d --build
```

- Dashboard → http://localhost:3000
- The `migrate` service applies the schema automatically before web/bot start.

Full walkthrough: **[docs/self-hosting.md](docs/self-hosting.md)**.

## Local development

Prerequisites: Node 20.9+, a running Postgres, and
[aube](https://github.com/). The dev server is assumed to be already running in
this repo's workflow.

```bash
aube install                 # install dependencies
cp .env.example .env         # then edit values

aube run db:push             # create tables (dev) — or db:migrate for prod-style
aube run dev                 # web dashboard on :3000
aube run bot:dev             # Discord bot (separate terminal)
```

Useful scripts (run with `aube run <name>`):

| Script            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `dev`             | Next.js dev server                              |
| `bot:dev`         | Bot with file-watch reload                      |
| `bot:register`    | Register slash commands (`… <guildId>` for one) |
| `db:push`         | Push schema straight to the DB (dev)            |
| `db:generate`     | Generate a SQL migration from schema changes    |
| `db:migrate:run`  | Apply migrations (used in Docker)               |
| `db:studio`       | Open Drizzle Studio                             |
| `lint` / `build`  | Lint / production build                         |

## Documentation

- [Discord application setup](docs/discord-setup.md) — token, OAuth, invite.
- [Self-hosting](docs/self-hosting.md) — Docker Compose in depth.
- [Configuration reference](docs/configuration.md) — env vars & guild settings.
- [Architecture](docs/architecture.md) — how it fits together & where to extend.

## Roadmap

- [x] Web-based server selection & configuration (Discord `guilds` scope + Manage Server checks)
- [x] Panels: create/post from dashboard, button-driven opening
- [x] Panel forms: modal questions asked on open, answers saved to the ticket
- [x] Ticket lifecycle: open → staff reply → close → transcript
- [x] Ticket claiming & member management, close reasons, log-channel audit
- [ ] Tags / canned responses and per-user blacklist
- [ ] Stats & transcript viewer in the dashboard

## License

See [LICENSE](LICENSE) if present; otherwise add one before distributing.
