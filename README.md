# «Фабрика идей»

Система для автоматического анализа и оценки идей: пользователь вводит идею → карточка → очередь → исследование → расчёт эффекта → критический отчёт → MVP.

## Предварительные требования

- **Node.js LTS** — `node -v` (рекомендуется 20+)
- **pnpm** — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker** — для БД и продакшн-контейнеров

## Быстрый старт

```bash
git clone <repo-url>
cd <project>
cp .env.example .env      # заполнить секреты
pnpm install
pnpm dev                   # http://localhost:3000
```

## Команды разработки

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Dev-сервер (Nuxt) |
| `pnpm build` | Production-сборка |
| `pnpm preview` | Локальный превью сборки |
| `pnpm lint` | ESLint |
| `pnpm lint:fix` | ESLint + автоисправление |
| `pnpm typecheck` | Проверка типов |
| `pnpm test` | Unit-тесты (Vitest) |
| `pnpm e2e` | E2E-тесты (Playwright) |
| `pnpm db:migrate` | Применить миграции |
| `pnpm db:new <name>` | Создать новую миграцию |

## Agentic Development

Проект использует [skills](https://github.com/opencode-ai/skills) — pluck-and-play инструкции для AI-агентов (opencode, Claude Code, Cursor и др.).

### Установка скиллов

```bash
pnpm skills
```

Команда аналогична `pnpm install`, но для скиллов. Скачивает и устанавливает все скиллы из `skills-lock.json` в `.agents/skills/`.

### Файлы

| Файл | Описание | Коммитится? |
|------|----------|-------------|
| `skills-lock.json` | Lockфайл с версиями скиллов | Да |
| `.agents/skills/` | Установленные скиллы | Нет (`.gitignore`) |

### Использование

AI-агент автоматически подхватывает скиллы из `.agents/skills/` при старте сессии. Дополнительных действий не требуется.

## Конфигурация

Скопируйте `.env.example` в `.env` и заполните значения:

```bash
cp .env.example .env
```

| Переменная | Обязательна | Описание |
|------------|-------------|----------|
| `POSTGRES_USER` | Да | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | Да | Пароль PostgreSQL |
| `POSTGRES_DB` | Да | Имя базы данных |
| `DATABASE_URL` | Да | URL подключения к БД |
| `ROUTERAI_API_KEY` | Да | API-ключ для LLM |
| `SENTRY_DSN` | Нет | DSN для Sentry |
| `LANGSMITH_API_KEY` | Нет | API-ключ LangSmith |
| `APP_ENV` | Нет | `production` или `development` |

## Деплой

### Docker (продакшн)

```bash
cp .env.example .env      # заполнить секреты
docker compose -f docker-compose.prod.yml up -d --build
```

Сервисы:
- **db** — PostgreSQL 16
- **web** — Nuxt SSR (порт 3000)
- **worker** — воркер очереди
- **validator** — микросервис-валидатор правил (порт 3001)
