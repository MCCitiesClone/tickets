"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { docsFlat } from "./docs-nav";

/**
 * Previous / next links at the foot of each doc page. Position is derived from
 * the flat page order in `docs-nav`, so it always matches the sidebar.
 */
export function DocPager() {
  const pathname = usePathname();
  const index = docsFlat.findIndex((l) => l.href === pathname);
  if (index === -1) return null;

  const prev = index > 0 ? docsFlat[index - 1] : null;
  const next = index < docsFlat.length - 1 ? docsFlat[index + 1] : null;

  return (
    <div className="mt-12 flex items-center justify-between gap-4 border-t pt-6">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex flex-col gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1 text-xs">
            <ArrowLeft className="size-3" /> Previous
          </span>
          <span className="font-medium">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="group flex flex-col items-end gap-1 text-right text-sm text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1 text-xs">
            Next <ArrowRight className="size-3" />
          </span>
          <span className="font-medium">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
