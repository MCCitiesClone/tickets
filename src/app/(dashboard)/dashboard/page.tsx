import type { ReactNode } from "react";
import { CheckCircle2, Circle } from "lucide-react";

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

  // Derive checklist state from real data so it reflects reality on refresh.
  const [botGuilds, configuredGuilds] = await Promise.all([
    fetchBotGuilds(),
    listGuilds(),
  ]);

  const botInvited = botGuilds.length > 0;
  const hasSetup = configuredGuilds.some((g) => g.ticketCategoryId);
  const hasStaff = configuredGuilds.some((g) => g.staffRoleIds.length > 0);

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
        ? "Ticket category configured."
        : "Initializes config and sets your ticket category.",
    },
    {
      done: hasStaff,
      title: "Configure staff roles & channels",
      description: hasStaff
        ? "Staff roles are set."
        : "Guild-level settings (coming to this dashboard next).",
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {session.user.name}</h1>
        <p className="text-muted-foreground">
          Configure and manage your Discord support tickets from here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            A few steps to get tickets running on your server.
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

      <Card>
        <CardHeader>
          <CardTitle>Server selection</CardTitle>
          <CardDescription>
            Choosing a server to configure — using your Discord “guilds” scope —
            lands here in the next iteration. For now, use{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/setup</code>{" "}
            in your server.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
