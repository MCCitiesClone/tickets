import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Ticket } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocPager } from "./doc-pager";
import { DocsSidebar } from "./docs-sidebar";

export const metadata: Metadata = {
  title: {
    default: "Documentation",
    template: "%s — Tickets docs",
  },
  description:
    "Guides and reference for self-hosting and configuring the Tickets Discord bot and dashboard.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Ticket className="size-5" />
          Tickets
          <span className="text-muted-foreground">docs</span>
        </Link>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Open dashboard <ArrowUpRight className="size-4" />
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-10 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20">
            <DocsSidebar />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <details className="mb-6 rounded-lg border p-3 md:hidden">
            <summary className="cursor-pointer text-sm font-medium">
              Browse documentation
            </summary>
            <div className="mt-3">
              <DocsSidebar />
            </div>
          </details>
          <article className="max-w-3xl">
            {children}
            <DocPager />
          </article>
        </main>
      </div>
    </div>
  );
}
