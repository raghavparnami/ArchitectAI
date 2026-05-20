# syntax=docker/dockerfile:1.7
# ─── Multi-stage Dockerfile for ArchitectAI (Next.js 16 + better-sqlite3) ────
# Stage 1: deps   — install full dependency set (incl. native build tools)
# Stage 2: build  — run `next build` to produce .next/standalone
# Stage 3: runner — minimal image that just runs the standalone server
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20.18.0

# ─── deps ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++ \
  && ln -sf python3 /usr/bin/python
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` is reproducible; include dev deps because `next build` needs them.
RUN npm ci

# ─── build ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Clerk needs SOMETHING to satisfy build-time env validation. Real values are
# injected by Railway at runtime — these are dummy placeholders so build passes.
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_build_placeholder
ENV CLERK_SECRET_KEY=sk_test_build_placeholder
# better-sqlite3 reads DATABASE_URL at module load; Next page-data
# collection imports the db module, so the build crashes without it.
# Railway only injects runtime env vars — this placeholder satisfies
# the build step and is overridden by the real value at runtime.
ENV DATABASE_URL=./architectai.db
RUN npm run build

# ─── runner ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway injects $PORT; Next standalone reads it.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js standalone output already includes a minimal node_modules.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
