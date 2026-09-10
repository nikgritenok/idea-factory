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

## Миграции (Prisma 8)

```bash
pnpm run db:migrate   # применить миграции (prisma db update)
pnpm run db:sign      # подписать контракт после изменений
```

Миграции применяются автоматически при старте `web`.

## Прод (docker-compose)

```bash
cp .env.example .env   # заполнить секреты
docker compose up -d --build
```

Сервисы: `db` (postgres:16), `web` (Nuxt SSR, миграции применяются на старте),
`worker` (persistent worker очереди), `validator` (микросервис-валидатор правил).
