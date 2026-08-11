import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emit a self-contained server bundle (.next/standalone) for a slim Docker
  // runtime image. See docs/self-hosting.md.
  output: "standalone",
  // `pg` and drizzle are server-only; keep them out of the bundle so native
  // bindings resolve at runtime.
  serverExternalPackages: ["pg", "drizzle-orm"],
};

export default nextConfig;
