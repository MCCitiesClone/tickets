import { CheckCircle2, Circle } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSession } from "@/lib/session";

const gettingStarted = [
  {
    done: true,
    title: "Sign in with Discord",
    description: "You're signed in — nice.",
  },
  {
    done: false,
    title: "Invite the bot to your server",
    description: "Use the “Add to Discord” button on the home page.",
  },
  {
    done: false,
    title: "Run /setup in your server",
    description: "Initializes config and sets your ticket category.",
  },
  {
    done: false,
    title: "Configure staff roles & channels",
    description: "Guild-level settings (coming to this dashboard next).",
  },
];

export default async function DashboardPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome, {session.user.name}
        </h1>
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
          {gettingStarted.map((step) => (
            <div key={step.title} className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-5 text-primary" />
              ) : (
                <Circle className="mt-0.5 size-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
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
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /setup
            </code>{" "}
            in your server.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
