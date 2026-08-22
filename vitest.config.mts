import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit-test setup for both halves of the project (the Next.js app and the
 * standalone bot), so a single `aube run test` covers everything.
 *
 * Tests default to the `node` environment; the few that render components opt
 * into jsdom with a `@vitest-environment jsdom` docblock, which keeps the fast
 * majority out of a DOM they don't need.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      // Several modules validate env at import time. Tests exercise logic, not
      // configuration, so short-circuit that the same way `next build` does.
      SKIP_ENV_VALIDATION: "1",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Generated, declarative, or purely-visual: nothing with logic to assert.
        "src/**/*.test.{ts,tsx}",
        "src/components/ui/**", // vendored shadcn primitives
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx", // server components: covered by the build, not units
        "src/db/schema/**", // table definitions
        "src/db/migrate.ts",
        "src/db/seed.ts",
        "src/bot/index.ts", // process bootstrap
        "src/**/*.d.ts",
      ],
    },
  },
});
