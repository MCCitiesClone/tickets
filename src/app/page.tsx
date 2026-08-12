import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  LayoutDashboard,
  MessagesSquare,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { botInviteUrl } from "@/lib/discord";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Channel-based tickets",
    description:
      "Each ticket is a private channel under a category, with per-user and staff-role permissions.",
  },
  {
    title: "Configurable panels",
    description:
      "Post buttons members click to open tickets, each mapped to its own settings.",
  },
  {
    title: "Web dashboard",
    description:
      "Configure staff roles, categories, transcripts and welcome messages from a browser.",
  },
  {
    title: "Self-hostable",
    description:
      "Ships with Docker Compose (web + bot + Postgres). Own your data end to end.",
  },
];

export default function Home() {
  // Server component: the invite URL is computed from server-only env.
  let inviteUrl: string | null = null;
  try {
    inviteUrl = botInviteUrl();
  } catch {
    // DISCORD_CLIENT_ID not configured yet — hide the invite button.
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <MessagesSquare className="size-3.5" />
          Open-source Discord tickets
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Support tickets for Discord,
          <br />
          run on your own terms.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A self-hostable tickets bot with a companion web dashboard. Configure
          everything in the browser; let members open tickets with a click.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            <LayoutDashboard /> Open dashboard
          </Link>
          <Link
            href="/docs"
            className={cn(buttonVariants({ size: "lg", variant: "ghost" }))}
          >
            <BookOpen /> Read the docs
          </Link>
          {inviteUrl && (
            <a
              href={inviteUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Add to Discord <ArrowRight />
            </a>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
