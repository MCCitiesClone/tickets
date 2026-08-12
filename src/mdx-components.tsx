import type { MDXComponents } from "mdx/types";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Global MDX component map. Required by `@next/mdx` in the App Router — every
 * `.mdx` file renders through these. Elements are styled with the app's design
 * tokens (see globals.css) instead of the Tailwind typography plugin so the
 * docs match the rest of the dashboard in both light and dark mode.
 *
 * Anchors are routed through next/link when they point at an internal path so
 * in-app doc navigation stays client-side.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ className, ...props }) => (
      <h1
        className={cn(
          "scroll-mt-24 text-3xl font-semibold tracking-tight",
          className,
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }) => (
      <h2
        className={cn(
          "mt-10 scroll-mt-24 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0",
          className,
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }) => (
      <h3
        className={cn(
          "mt-8 scroll-mt-24 text-xl font-semibold tracking-tight",
          className,
        )}
        {...props}
      />
    ),
    h4: ({ className, ...props }) => (
      <h4
        className={cn("mt-6 scroll-mt-24 text-lg font-semibold", className)}
        {...props}
      />
    ),
    p: ({ className, ...props }) => (
      <p
        className={cn("leading-7 [&:not(:first-child)]:mt-4", className)}
        {...props}
      />
    ),
    a: ({ className, href = "", ...props }) => {
      const classes = cn(
        "font-medium text-primary underline underline-offset-4 hover:no-underline",
        className,
      );
      const isInternal = href.startsWith("/");
      if (isInternal) {
        return <Link href={href} className={classes} {...props} />;
      }
      return (
        <a
          href={href}
          className={classes}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
          {...props}
        />
      );
    },
    ul: ({ className, ...props }) => (
      <ul
        className={cn("my-4 ml-6 list-disc space-y-2 [&>li]:mt-0", className)}
        {...props}
      />
    ),
    ol: ({ className, ...props }) => (
      <ol
        className={cn("my-4 ml-6 list-decimal space-y-2", className)}
        {...props}
      />
    ),
    li: ({ className, ...props }) => (
      <li className={cn("leading-7", className)} {...props} />
    ),
    blockquote: ({ className, ...props }) => (
      <blockquote
        className={cn(
          "mt-4 border-l-2 border-border pl-4 text-muted-foreground italic",
          className,
        )}
        {...props}
      />
    ),
    code: ({ className, ...props }) => (
      <code
        className={cn(
          "rounded bg-muted px-[0.4rem] py-[0.2rem] font-mono text-sm",
          className,
        )}
        {...props}
      />
    ),
    pre: ({ className, ...props }) => (
      <pre
        className={cn(
          "mt-4 overflow-x-auto rounded-lg border bg-muted p-4 text-sm [&>code]:bg-transparent [&>code]:p-0",
          className,
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }) => (
      <hr className={cn("my-8 border-border", className)} {...props} />
    ),
    table: ({ className, ...props }) => (
      <div className="my-6 w-full overflow-x-auto">
        <table
          className={cn("w-full border-collapse text-sm", className)}
          {...props}
        />
      </div>
    ),
    th: ({ className, ...props }) => (
      <th
        className={cn(
          "border-b px-3 py-2 text-left font-semibold [&[align=center]]:text-center",
          className,
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }) => (
      <td
        className={cn(
          "border-b border-border/60 px-3 py-2 align-top [&[align=center]]:text-center",
          className,
        )}
        {...props}
      />
    ),
    ...components,
  };
}
