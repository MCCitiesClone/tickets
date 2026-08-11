# Discord application setup

You need one Discord application that provides **both** the bot user and the
OAuth2 credentials the dashboard signs in with.

## 1. Create the application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   and click **New Application**. Give it a name (e.g. "Tickets").
2. On the **General Information** page, copy the **Application ID** →
   `DISCORD_CLIENT_ID`.

## 2. Create the bot

1. Open the **Bot** tab.
2. Click **Reset Token**, then copy it → `DISCORD_TOKEN`. Keep this secret.
3. Under **Privileged Gateway Intents**, you can leave all of them **off** for
   now — the scaffold only uses the (non-privileged) Guilds intent. You'll enable
   *Server Members* / *Message Content* later if you add transcript capture.

## 3. OAuth2 credentials (dashboard sign-in)

1. Open the **OAuth2** tab.
2. Copy the **Client Secret** (Reset if needed) → `DISCORD_CLIENT_SECRET`.
3. Add a **Redirect** URL that matches your dashboard:
   ```
   http://localhost:3000/api/auth/callback/discord
   ```
   For production use your real domain, e.g.
   `https://tickets.example.com/api/auth/callback/discord`. This must line up
   with `BETTER_AUTH_URL`.

## 4. Invite the bot to a server

Open the home page of the running dashboard and click **Add to Discord** — the
invite URL is generated for you with the correct scopes and permissions.

Prefer to build it manually? Use:

```
https://discord.com/oauth2/authorize?client_id=<DISCORD_CLIENT_ID>&scope=bot+applications.commands&permissions=268561424
```

The bot requests: View Channels, Manage Channels, Manage Roles, Send Messages,
Embed Links, Attach Files, Read Message History, Manage Messages — everything
needed to create and manage private ticket channels. (See
`src/lib/discord.ts`.)

## 5. Register slash commands

Commands register automatically when the bot starts (see
`src/bot/events/ready.ts`). To force a manual registration:

```bash
aube run bot:register            # global (can take up to ~1h to appear)
aube run bot:register <guildId>  # single guild, instant — great for testing
```

Set `DISCORD_DEV_GUILD_ID` in `.env` to always register to your test guild
during development.

Registration keeps autocomplete tidy: the bulk overwrite removes any command
you've deleted from the registry, and registering to a guild also clears the
**global** commands so they don't show up twice. Because of that, use a
**separate Discord application for development vs production** so dev
registration never wipes your production global commands.
