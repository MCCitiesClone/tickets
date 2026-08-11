"use client";

import { useEffect } from "react";
import { Database, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Dashboard error boundary. The most common failure here is the database being
 * unreachable (session lookup / config queries), so we call that out explicitly
 * instead of showing a stack trace.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <Database className="size-8 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Couldn&apos;t load the dashboard</h1>
      <p className="text-muted-foreground">
        This usually means the database is unreachable. Make sure Postgres is
        running and <code className="rounded bg-muted px-1 py-0.5">DATABASE_URL</code>{" "}
        is correct, then try again.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={reset}>
        <RotateCw /> Try again
      </Button>
    </div>
  );
}
