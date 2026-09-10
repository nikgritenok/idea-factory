# syntax=docker/dockerfile:1

# ---- deps ----
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- build ----
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run postinstall && pnpm run build

# ---- migrate (one-shot) ----
FROM node:24-alpine AS migrate
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/prisma ./src/prisma
COPY migrations ./migrations
CMD ["sh", "-c", "pnpm prisma db update --confirm idea_factory && pnpm prisma db sign"]

# ---- runtime ----
FROM node:24-alpine AS runtime
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=app:app /app/.output ./.output
USER app
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
