import type { ReactNode } from "react";
import { CheckCircle2, Circle, TriangleAlert } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchBotGuilds } from "@/lib/discord-api";
import { botInviteUrl } from "@/lib/discord";
import { listGuilds } from "@/lib/queries/guild";
import { requireSession } from "@/lib/session";
import { InviteButton } from "./invite-button";

type Step = {
  done: boolean;
  title: string;
  description: string;
  action?: ReactNode;
};

export default async function DashboardPage() {
  const session = await requireSession();

  // Derive checklist state from real data. Both calls are defensive: if the DB
  // read throws it bubbles to the dashboard error boundary; Discord failures are
  // reported via `discordOk` so we don't show misleading progress.
  const [{ guilds: botGuilds, ok: discordOk }, configuredGuilds] =
    await Promise.all([fetchBotGuilds(), listGuilds()]);

  const botInvited = botGuilds.length > 0;
  const hasSetup = configuredGuilds.length > 0;
  const isConfigured = configuredGuilds.some(
    (g) => g.ticketCategoryId && g.staffRoleIds.length > 0,
  );

  let inviteUrl: string | null = null;
  try {
    inviteUrl = botInviteUrl();
  } catch {
    // DISCORD_CLIENT_ID not configured — hide the invite button.
  }

  const steps: Step[] = [
    {
      done: true,
      title: "Sign in with Discord",
      description: "You're signed in — nice.",
    },
    {
      done: botInvited,
      title: "Invite the bot to your server",
      description: botInvited
        ? `The bot is in ${botGuilds.length} server${botGuilds.length === 1 ? "" : "s"}.`
        : "Add the bot to a server to get started.",
      action:
        !botInvited && inviteUrl ? (
          <InviteButton
            inviteUrl={inviteUrl}
            initialBotGuildCount={botGuilds.length}
          />
        ) : null,
    },
    {
      done: hasSetup,
      title: "Run /setup in your server",
      description: hasSetup
        ? `${configuredGuilds.length} server${configuredGuilds.length === 1 ? "" : "s"} initialized.`
        : "Run /setup in your server to initialize its configuration.",
    },
    {
      done: isConfigured,
      title: "Set a ticket category & staff roles",
      description: isConfigured
        ? "Ticket category and staff roles are set."
        : "Set a ticket category and at least one staff role (via /setup or Settings).",
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {session.user.name}</h1>
        <p className="text-muted-foreground">
          Configure and manage your Discord support tickets from here.
        </p>
      </div>

      {!discordOk && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Couldn&apos;t reach Discord</p>
            <p className="text-muted-foreground">
              The bot&apos;s server list couldn&apos;t be fetched, so the
              &ldquo;invite&rdquo; step below may be out of date. Check
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
                DISCORD_TOKEN
              </code>
              and that Discord is reachable.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            {completed} of {steps.length} steps complete.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {steps.map((step) => (
            <div key={step.title} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                {step.action}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
