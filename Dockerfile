# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
# libc6-compat helps some native/prebuilt deps run on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# Dependencies (npm ci from the committed lockfile — reproducible, and npm is
# always available in the node image. Local dev still uses `aube`; both read the
# same package-lock.json.)
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Web build → Next.js standalone output
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Secrets aren't needed to build (no NEXT_PUBLIC_* here); skip env validation.
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1
RUN npm run build

# ---------------------------------------------------------------------------
# Web runtime — minimal standalone server
# ---------------------------------------------------------------------------
FROM base AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------
# Bot runtime (also used for the one-shot migrate step). Runs TypeScript
# directly with tsx; needs full deps + source + generated migrations.
# ---------------------------------------------------------------------------
FROM base AS bot
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npx", "tsx", "src/bot/index.ts"]
