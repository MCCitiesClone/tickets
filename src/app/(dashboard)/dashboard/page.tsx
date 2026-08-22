import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  BellRing,
  BookOpen,
  CheckCircle2,
  Circle,
  type LucideIcon,
  MessageSquare,
  MessageSquareText,
  PanelsTopLeft,
  Settings,
  Ticket,
  TriangleAlert,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveGuild } from "@/lib/active-guild";
import { fetchBotGuilds } from "@/lib/discord-api";
import { botInviteUrl } from "@/lib/discord";
import { formatDuration } from "@/lib/duration";
import { getGuild } from "@/lib/queries/guild";
import { getGuildStats } from "@/lib/queries/stats";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { InviteButton } from "./invite-button";
import { VolumeChart } from "./volume-chart";

type Step = {
  done: boolean;
  title: string;
  description: string;
  action?: ReactNode;
};

const STATS_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 py-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 font-medium">
          {title}
          <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();

  // Derive checklist state from real data. Discord failures are reported via
  // `discordOk` so we don't show misleading progress. The config step reflects
  // the currently-selected (active) server.
  const [{ guilds: botGuilds, ok: discordOk }, { active }] = await Promise.all([
    fetchBotGuilds(),
    getActiveGuild(),
  ]);
  const activeConfig = active ? await getGuild(active.id) : null;

  const botInvited = botGuilds.length > 0;
  const isConfigured = Boolean(
    activeConfig?.ticketCategoryId && activeConfig.staffRoleIds.length > 0,
  );
  const setupComplete = botInvited && isConfigured;

  // Glanceable stats for the active server (fixed recent window; the Stats page
  // has the range selector + detail).
  const to = new Date();
  const from = new Date(to.getTime() - STATS_WINDOW_DAYS * DAY_MS);
  const stats = active ? await getGuildStats(active.id, { from, to }) : null;

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
      done: isConfigured,
      title: "Configure a server",
      description: isConfigured
        ? `${active?.name ?? "Your server"} has a ticket category and staff roles.`
        : active
          ? `Set ${active.name}'s ticket category and staff roles in Settings.`
          : "Pick a server in the sidebar, then set its ticket category and staff roles.",
      action: !isConfigured ? (
        <Link
          href="/dashboard/settings"
          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        >
          <Settings /> Open settings
        </Link>
      ) : null,
    },
  ];
  const completed = steps.filter((s) => s.done).length;

  const quickLinks = [
    {
      href: "/dashboard/panels",
      title: "Panels",
      description: "Create and post ticket panels.",
      icon: PanelsTopLeft,
    },
    {
      href: "/dashboard/tickets",
      title: "Tickets",
      description: stats
        ? `${stats.summary.currentlyOpen} open · browse & transcripts`
        : "Browse tickets and transcripts.",
      icon: Ticket,
    },
    {
      href: "/dashboard/canned-responses",
      title: "Canned responses",
      description: "Saved, reusable staff replies.",
      icon: MessageSquareText,
    },
    {
      href: "/dashboard/on-call",
      title: "On call",
      description: "Staff DMed the moment a ticket opens.",
      icon: BellRing,
    },
    {
      href: "/dashboard/blacklist",
      title: "Blacklist",
      description: "Block users or roles from opening tickets.",
      icon: Ban,
    },
    {
      href: "/dashboard/messages",
      title: "Messages",
      description: "Welcome and system message templates.",
      icon: MessageSquare,
    },
    {
      href: "/dashboard/settings",
      title: "Settings",
      description: "Category, staff roles, transcripts, overflow.",
      icon: Settings,
    },
    {
      href: "/docs",
      title: "Documentation",
      description: "Guides and slash-command reference.",
      icon: BookOpen,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
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

      {!setupComplete && (
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <p className="text-sm text-muted-foreground">
              {completed} of {steps.length} steps complete.
            </p>
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
      )}

      {stats && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Last {STATS_WINDOW_DAYS} days
            </h2>
            <Link
              href="/dashboard/stats"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Detailed stats
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Opened" value={String(stats.summary.openedInRange)} />
            <StatCard label="Closed" value={String(stats.summary.closedInRange)} />
            <StatCard
              label="Currently open"
              value={String(stats.summary.currentlyOpen)}
            />
            <StatCard
              label="Avg first response"
              value={formatDuration(stats.summary.avgFirstResponseSeconds)}
              hint={`${stats.summary.respondedCount} of ${stats.summary.openedInRange} answered`}
            />
            <StatCard
              label="Avg resolution"
              value={formatDuration(stats.summary.avgResolutionSeconds)}
              hint={`${stats.summary.closedInRange} closed`}
            />
            <StatCard
              label="Avg rating"
              value={
                stats.summary.avgRating != null
                  ? `${stats.summary.avgRating.toFixed(1)} ★`
                  : "—"
              }
              hint={`${stats.summary.ratingCount} rated`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ticket volume</CardTitle>
            </CardHeader>
            <CardContent>
              <VolumeChart daily={stats.daily} />
            </CardContent>
          </Card>
        </section>
      )}

      {active && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Manage</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((l) => (
              <QuickLink key={l.href} {...l} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
