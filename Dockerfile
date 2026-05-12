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

# Install only mcp + transitive deps (skip ui/tui/admin — saves ~50% time, avoids sharp)
RUN pnpm install --frozen-lockfile --filter @gerber-caserne/mcp...

# Copy source
COPY packages/shared packages/shared
COPY packages/mcp packages/mcp

# Build — runtime only, skip .d.ts (declarations are a publish concern and the
# rollup-plugin-dts path inside tsup misreads top-level await in this image).
RUN pnpm --filter @gerber-caserne/mcp exec tsup --no-dts

# Pre-fetch E5 model so the runtime image is offline-capable
RUN node packages/mcp/dist/scripts/prefetch-model.js

# ─── Stage 2: runtime ──────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# Remove the default `node` user (UID 1000) shipped with the base image, then
# create our `gerber` user with the same UID so volumes mounted from the VPS
# (also UID 1000) are owned correctly.
RUN userdel -r node 2>/dev/null || true \
 && useradd -u 1000 -m -s /bin/bash gerber

WORKDIR /app

# pnpm uses an isolated node_modules layout: top-level deps for each package
# live in packages/<pkg>/node_modules as symlinks pointing into the central
# /app/node_modules/.pnpm store. We must copy both the root node_modules
# (which holds the .pnpm store) AND each package's node_modules (which holds
# the symlinks Node uses to resolve imports).
COPY --from=build --chown=gerber:gerber /app/node_modules ./node_modules
COPY --from=build --chown=gerber:gerber /app/packages/shared ./packages/shared
COPY --from=build --chown=gerber:gerber /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY --from=build --chown=gerber:gerber /app/packages/mcp/dist ./packages/mcp/dist
COPY --from=build --chown=gerber:gerber /app/packages/mcp/package.json ./packages/mcp/

# Note: the E5 model cache is bundled inside
# node_modules/.pnpm/@huggingface+transformers@*/.../@huggingface/transformers/.cache
# (transformers.js v3 caches inside its own package by default), so copying
# the root node_modules is enough — no separate HF_HOME copy needed.

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

CMD ["node", "packages/mcp/dist/index.js", "--ui", "--stream"]
