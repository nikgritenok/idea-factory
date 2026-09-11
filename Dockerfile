# syntax=docker/dockerfile:1

# ---- base ----
FROM node:24-alpine AS base
RUN corepack enable

# ---- deps (cached install, used by migrate) ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---- build ----
FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts && \
    pnpm run postinstall && \
    pnpm run build && \
    pnpm prune --prod --ignore-scripts

# ---- migrate (one-shot) ----
FROM base AS migrate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/prisma ./src/prisma
COPY migrations ./migrations
CMD ["sh", "-c", "pnpm prisma db update --confirm idea_factory && pnpm prisma db sign"]

# ---- runtime ----
FROM base AS runtime
RUN apk add --no-cache ffmpeg && addgroup -g 1001 -S app && adduser -S app -u 1001 -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /app/.output ./.output
COPY --from=build --chown=app:app /app/node_modules ./node_modules
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
