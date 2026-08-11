import Link from "next/link";
import { ChevronRight, Settings as SettingsIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getManageableGuilds } from "@/lib/guild-access";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { EmptyState, PageHeader } from "../../page-shell";

export default async function SettingsPage() {
  await requireSession();
  const { guilds, ok, botHasGuilds } = await getManageableGuilds();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Choose a server to configure its ticket settings."
      />

      {guilds.length === 0 ? (
        <EmptyState
          icon={<SettingsIcon className="size-8" />}
          title={
            !botHasGuilds
              ? "The bot isn't in any server yet"
              : !ok
                ? "Couldn't reach Discord"
                : "No manageable servers"
          }
          description={
            !botHasGuilds
              ? "Invite the bot to a server first, then come back here to configure it."
              : !ok
                ? "We couldn't load your servers from Discord. Check your connection and DISCORD_TOKEN, then try again."
                : "You can only configure servers where you have the Manage Server permission and the bot is present."
          }
        >
          {!botHasGuilds && (
            <Link href="/dashboard" className={cn(buttonVariants())}>
              Back to overview
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2">
          {guilds.map((g) => (
            <Link
              key={g.id}
              href={`/dashboard/settings/${g.id}`}
              className="group"
            >
              <Card className="transition-colors hover:border-ring">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {g.configured ? "Configured" : "Not configured yet"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
