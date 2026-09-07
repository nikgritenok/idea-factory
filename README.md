# «Фабрика идей» — запуск

## Локальная разработка

```bash
pnpm install
pnpm run dev          # Nuxt на http://localhost:3000
```

Тестовая БД (для автотестов):

```bash
docker run -d --name idea-factory-test-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=idea_factory_test \
  -p 5434:5432 postgres:16-alpine
pnpm test
```

## Прод (docker-compose)

```bash
cp .env.example .env   # заполнить секреты
docker compose up -d --build
```

Сервисы: `db` (postgres:16), `web` (Nuxt SSR, миграции применяются на старте),
`worker` (persistent worker очереди), `validator` (микросервис-валидатор правил).

Миграции применяются автоматически при старте `web` (`RUN_MIGRATIONS=true`).
Ручное применение (читает `DATABASE_URL`):

```bash
DATABASE_URL=postgres://... pnpm run db:migrate
DATABASE_URL=postgres://... pnpm run db:down
DATABASE_URL=postgres://... pnpm run db:status
```
