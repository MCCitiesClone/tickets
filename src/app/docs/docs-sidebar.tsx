"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { docsNav } from "./docs-nav";

/** Left-hand navigation for the docs, with the current page highlighted. */
export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {docsNav.map((section) => (
        <div key={section.title} className="flex flex-col gap-1">
          <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {section.title}
          </p>
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === link.href
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground",
              )}
            >
              {link.title}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
