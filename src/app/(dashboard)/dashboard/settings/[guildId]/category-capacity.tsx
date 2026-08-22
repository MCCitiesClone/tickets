import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import type { Guild, Panel } from "@/db/schema";
import {
  CATEGORY_CHANNEL_LIMIT,
  categoryCapacityLevel,
  categoryRemaining,
  type CategoryCapacityLevel,
} from "@/lib/category-capacity";
import type { DiscordChannel } from "@/lib/discord-api";
import { cn } from "@/lib/utils";

type CapacityRow = {
  id: string;
  name: string | null;
  role: string;
  used: number;
};

/** Bar tint per capacity level — green is the plain default, so only warn/full tint. */
const INDICATOR_CLASS: Record<CategoryCapacityLevel, string> = {
  ok: "",
  warning: "[&_[data-slot=progress-indicator]]:bg-orange-500",
  full: "[&_[data-slot=progress-indicator]]:bg-destructive",
};

/**
 * Every category tickets can land in, in the order the bot tries them: the
 * server default, any panel overrides, then the admin-configured and
 * bot-created overflow chains. Deduplicated — the first role a category takes
 * is the one shown.
 */
function capacityRows(
  config: Guild | null,
  panels: Panel[],
  categories: DiscordChannel[],
): CapacityRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows: CapacityRow[] = [];
  const seen = new Set<string>();

  const add = (id: string | null, role: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    rows.push({
      id,
      name: byId.get(id)?.name ?? null,
      role,
      used: byId.get(id)?.childCount ?? 0,
    });
  };

  add(config?.ticketCategoryId ?? null, "Server default");
  for (const panel of panels) add(panel.categoryId, `Panel: ${panel.title}`);
  for (const id of config?.overflowCategoryIds ?? []) add(id, "Overflow");
  for (const id of config?.autoOverflowCategoryIds ?? []) {
    add(id, "Auto-overflow");
  }

  return rows;
}

/**
 * Per-category channel usage against Discord's 50-per-category cap, so admins
 * see a ticket category filling up before opens start spilling into overflow.
 * Counts come from Discord's channel list, which is cached for a few minutes.
 */
export function CategoryCapacity({
  config,
  panels,
  categories,
}: {
  config: Guild | null;
  panels: Panel[];
  categories: DiscordChannel[];
}) {
  const rows = capacityRows(config, panels, categories);
  const strained = rows.filter(
    (r) => r.name !== null && categoryCapacityLevel(r.used) !== "ok",
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div>
          <h2 className="text-sm font-medium">Category capacity</h2>
          <p className="text-xs text-muted-foreground">
            Discord allows {CATEGORY_CHANNEL_LIMIT} channels per category, and
            every open ticket is a channel.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ticket category is configured yet — pick one below.
          </p>
        ) : (
          <>
            {strained.length > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-400">
                <AlertTriangle className="mt-px size-4 shrink-0" />
                <span>
                  {strained.length === 1
                    ? `${strained[0].name} is nearly full.`
                    : `${strained.length} categories are nearly full.`}{" "}
                  {config?.autoCreateOverflow
                    ? "Auto-overflow is on, so the bot will create another category as needed."
                    : "Auto-overflow is off — add an overflow category below, or new tickets will start failing."}
                </span>
              </p>
            )}

            <div className="flex flex-col gap-4">
              {rows.map((row) => {
                const level = categoryCapacityLevel(row.used);
                return (
                  <Progress
                    key={row.id}
                    value={row.used}
                    max={CATEGORY_CHANNEL_LIMIT}
                    className={cn("gap-x-3 gap-y-1.5", INDICATOR_CLASS[level])}
                  >
                    <ProgressLabel className="truncate">
                      {row.name ?? "Deleted category"}
                    </ProgressLabel>
                    <Badge variant="outline" className="shrink-0">
                      {row.role}
                    </Badge>
                    <ProgressValue>
                      {(_, value) =>
                        row.name === null
                          ? "not found"
                          : `${value ?? 0}/${CATEGORY_CHANNEL_LIMIT} · ${categoryRemaining(row.used)} free`
                      }
                    </ProgressValue>
                  </Progress>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
