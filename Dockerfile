# syntax=docker/dockerfile:1.7

# ─── Stage 1: build ─────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Native deps for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Workspace manifests first (layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp/package.json packages/mcp/

# Install only mcp + transitive deps (skip admin — saves time, avoids cargo)
RUN pnpm install --frozen-lockfile --filter @gerber-caserne/mcp...

# Copy source
COPY packages/shared packages/shared
COPY packages/mcp packages/mcp

# Build with DTS — tsup config now forces `module: esnext` for the dts
# compiler options (see packages/mcp/tsup.config.ts), so rollup-plugin-dts
# stops choking on top-level await in this image.
RUN pnpm --filter @gerber-caserne/mcp build

# Pack a prod-only deployment of @gerber-caserne/mcp into /out using `pnpm deploy`.
# Unlike `pnpm prune`, this is workspace-aware: it walks the dependency graph
# of the target package, copies only prod deps, inlines workspace deps
# (@gerber-caserne/shared), and produces a standalone tree that doesn't need
# pnpm at runtime.
RUN pnpm --filter @gerber-caserne/mcp deploy --prod /out

# ─── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Remove the default `node` user (UID 1000) shipped with the base image, then
# create our `gerber` user with the same UID so volumes mounted from the VPS
# (also UID 1000) are owned correctly.
RUN userdel -r node 2>/dev/null || true \
 && useradd -u 1000 -m -s /bin/bash gerber

WORKDIR /app

# /out from the build stage is a self-contained, prod-only deployment of
# @gerber-caserne/mcp. It contains: package.json (mcp), dist/, and
# node_modules with only runtime deps (express, better-sqlite3, drizzle-orm,
# @modelcontextprotocol/sdk, zod).
COPY --from=build --chown=gerber:gerber /out ./

RUN mkdir -p /data && chown gerber:gerber /data
VOLUME /data

USER gerber
ENV NODE_ENV=production
ENV GERBER_DATA_DIR=/data
ENV GERBER_BIND_HOST=0.0.0.0
ENV PORT=3000
ENV HOME=/home/gerber

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js", "--stream"]
