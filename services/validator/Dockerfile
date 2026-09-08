FROM node:20-alpine

WORKDIR /app

# Копируем зависимости
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Копируем исходники
COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/index.ts"]
