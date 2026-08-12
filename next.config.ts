import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit a self-contained server bundle (.next/standalone) for a slim Docker
  // runtime image. See docs/self-hosting.md.
  output: "standalone",
  // `pg` and drizzle are server-only; keep them out of the bundle so native
  // bindings resolve at runtime.
  serverExternalPackages: ["pg", "drizzle-orm"],
  // Let `.mdx`/`.md` files act as pages (powers the in-app docs at /docs).
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
};

// `@next/mdx` compiles MDX in Server Components. `remark-gfm` adds GitHub
// Flavored Markdown (notably tables, which the docs rely on). Plugins are
// passed by string name so they stay Turbopack-compatible.
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [["remark-gfm", {}]],
  },
});

export default withMDX(nextConfig);
