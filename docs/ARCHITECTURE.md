# ARCHITECTURE.md — Стек и архитектура проекта

## Стек технологий

| Слой | Технология | Назначение |
|------|-----------|------------|
| Framework | Nuxt 4.5 (Nitro) | Full-stack SSR/CSR, файловый роутинг, server routes |
| Language | TypeScript | Строгая типизация, общая кодовая база |
| ORM | Prisma 8 (orm-postgres) | Типобезопасный ORM с SQL-first контрактами |
| Database | PostgreSQL 16 | Основная реляционная БД |
| Migrations | Prisma 8 | SQL-миграции через Prisma (файлы в `prisma/`) |
| Validation | Zod | Валидация данных на границах (API, route params, env vars) |
| AI/Orchestration | LangGraph.js 1.4 + PostgresSaver | StateGraph для пайплайна анализа, checkpointing в Postgres |
| State | Pinia | Управление состоянием на клиенте |
| Build | Vite 8 | Сборка клиентской части |
| Package manager | pnpm | Управление зависимостями |
| Linting | ESLint + @nuxt/eslint + stylistic | Статический анализ кода |
| Pre-commit | husky + lint-staged | Автоформатирование и проверка перед коммитом |
| Unit Testing | Vitest | Unit-тесты, интеграционные тесты |
| E2E Testing | Playwright | End-to-end тесты + CLI для AI-агента |
| Error Monitoring | Sentry (@sentry/nuxt) | Ошибки, stack trace, release tracking |
| Structured Logging | evlog | Один широкий event на запрос, structured JSON |
| Runtime | Node.js (LTS) | Серверный рантайм |
| Language Runtime | tsx | Запуск .ts файлов (CLI worker, миграции) |

## Структура проекта

```
app/                  # Frontend (Vue 3)
  features/           # Feature-based organization
    ideas/            # Карточка идеи (компонент + composable + тесты)
    funnel/           # Воронка
    create-idea/      # Создание идеи
    voice-input/      # Голосовой ввод
  components/         # Shared UI-компоненты (кнопки, карточки)
    ui/               # shadcn-vue
  composables/        # Глобальные composable (useAuth, useToast)
  pages/              # Тонкие обёртки (<FeatureName />)
  layouts/
  middleware/
  utils/
  stores/             # Pinia-сторы

server/               # Backend (Nitro)
  api/                # API-маршруты (auto-imported by Nitro)
    ideas/            # CRUD идей + запуск анализа
    jobs/             # Управление задачами очереди
  utils/
    api/              # API helpers (error.ts — единый apiError)
    db.ts             # Синглтон postgres.js
    ideas.ts          # Хелперы для ideas, лимит 10 активных
    llm.ts            # LLM-клиент (z-ai/glm-5.3-flash через routerai.ru)
    stt.ts            # STT через routerai.ru
  queue/              # Очередь задач + LangGraph-воркер
    llm-executor.ts   # LLM-исполнитель (вызов LLM + Zod-валидация)
  plugins/            # Nitro-плагины (db-migrate, worker)

shared/               # Общий код (app/ + server/)
  schemas/            # Zod schemas — единый источник правды
    roles/            # Zod-схемы для валидации ответов LLM-ролей
  types/
  utils/

e2e/                  # Playwright E2E-тесты
  smoke.spec.ts       # Smoke-тесты: homepage, meta, request-id

config/               # Конфиги пайплайна (steps, лимиты, очереди)
  roles/              # Конфиги ролей (промпты, параметры, Zod-схемы)
  components/         # Каталог компонентов (LLM, STT, валидатор)
src/prisma/           # Prisma 8 contract, db.ts entry point
docs/                 # Документация

services/             # Микросервисы (изолированные контейнеры)
  validator/          # Валидатор правил (node:http, POST /validate, GET /version)

sentry.client.config.ts  # Sentry client-side init
sentry.server.config.ts  # Sentry server-side init
playwright.config.ts     # Playwright конфиг (Chromium, webServer)
```

## Архитектура потока данных (TZ §6)

```
UI (app/) → API (Nitro routes) → Postgres (карточки, версии, аудио, источники, прогоны, расчёты)
                                      ↓
                          очередь + LangGraph воркер (persistent worker)
                                      ↓
                  ИИ-решения (routerai.ru) и микросервисы (валидатор правил)
                                      ↓
                          журнал прогонов → расчётный модуль → отчёт → MVP
```

### Наблюдаемость (Observability)

```
Запрос → evlog (один широкий event) → stdout (JSON)
              ↓
         Sentry (ошибки + stack trace)
              ↓
         X-Request-Id header (генерируется evlog)
```

- **evlog**: один event на каждый API-запрос со всем контекстом (user, idea, step, duration). Конфиг: `evlog/nuxt` модуль, `include: ['/api/**']`
- **Sentry**: автоматическая инструментация client + server через `@sentry/nuxt/module`. DSN через `runtimeConfig`. Source maps заливаются через Vite plugin
- **Playwright**: E2E-тесты в `e2e/`, Chromium-only. `webServer` автоматически поднимает `pnpm dev`. CLI (`@playwright/cli`) для AI-агента

### Очередь и воркер (TZ §8)

- **Очередь**: кастомная на PostgreSQL (`queue_jobs`), поддержка приоритетов (high/medium/low), anti-starvation, лимит 10 активных идей
- **Воркер**: LangGraph.js `StateGraph` с `Annotation.Root`, checkpointing через `@langchain/langgraph-checkpoint-postgres` (`PostgresSaver`)
- **Состояние на сервере**: закрытие вкладки не останавливает выполнение; перезапуск воркера продолжает с последнего чекпоинта
- **Управление**: пауза/продолжение/отмена/повтор шага/смена приоритета — через API (`/api/jobs/:id/*`)
- **Режимы запуска**:
  - `WORKER_MODE=true` — Nitro-плагин запускает воркер в фоне (docker-compose worker service)
  - `pnpm run worker` — standalone CLI (`worker-cli.ts`)
- **Executor Registry**: плагинная архитектура исполнителей шагов (`registerExecutor`), fixture-реализация для прототипа, реальные ИИ-вызовы подключены (этап 5)

### Проверенные сценарии (автотесты + ручная проверка)

| Сценарий | Тест | Статус |
|----------|------|--------|
| Enqueue идемпотентно | queue.test.ts | ✅ |
| Claim с приоритетами | queue.test.ts | ✅ |
| Anti-starvation | queue.test.ts | ✅ |
| Параллельный claim | queue.test.ts | ✅ |
| Key release при re-enqueue | queue.test.ts | ✅ |
| Полный прогон (7 шагов) | worker.test.ts | ✅ |
| Crash-restart (resume) | worker.test.ts | ✅ |
| Pause + resume | worker.test.ts | ✅ |
| Cancel | worker.test.ts | ✅ |
| Failure + retry | worker.test.ts | ✅ |
| Retry-step (time-travel) | worker.test.ts | ✅ |
| Priority воркер | worker.test.ts | ✅ |
| API create + enqueue + status | ручная (curl) | ✅ |
| Retry-step через API | ручная (curl) | ✅ |
| Homepage loads | smoke.spec.ts | ✅ |
| Meta title | smoke.spec.ts | ✅ |
| API request-id header | smoke.spec.ts | ✅ |

### LangGraph.js — детали

- **Версия**: 1.4.14 (текущая стабильная)
- **Checkpointing**: `@langchain/langgraph-checkpoint-postgres@1.0.5` через `pg.Pool`
- **Паттерн time-travel**: `graph.invoke(null, historicalConfig)` для replay с исторического чекпоинта
- **Примечание**: `graph.stream(null, config)` выбрасывает ошибку для已完成ных потоков; для time-travel используется `invoke`
- **Anti-starvation**: формула `basePriority × 10 - attempts × 2 + ageInCycles × 0.5`, clamp 0–100

### LLM-слой (этап 5)

- **Модель**: `z-ai/glm-5.3-flash` через routerai.ru (OpenAI-compatible `/v1/chat/completions`)
- **Клиент**: `server/utils/llm.ts` — `callLlm(schema, options)` с Zod-валидацией ответа
- **Конфиги ролей**: `config/roles/` — system/user промпты, параметры (temperature, maxTokens, timeout), Zod-схемы для валидации
- **Валидация**: битый ответ модели → `LlmError` → retry (если retries > 0)
- **Маркировка**: LLM-прогоны помечаются `LLM:` (не `FIXTURE:`) в логах

#### Роли пайплайна

| Роль | Executor | Temperature | MaxTokens | Timeout |
|------|----------|-------------|-----------|---------|
| Оркестратор | `llm` | 0.3 | 1024 | 60s |
| Аналитик идеи | `llm` | 0.3 | 2048 | 60s |
| Аналитик рынка | `llm` | 0.5 | 4096 | 90s |
| Стратег-аналитик | `llm` | 0.5 | 3072 | 90s |
| Аналитик эффективности | `calc` (детерминированный) | — | — | 30s |
| Критик | `llm` | 0.3 | 2048 | 60s |
| Редактор отчёта | `fixture` | — | — | 30s |

### Микросервис-валидатор (TZ §9/§11)

- **Назначение**: Проверка правил классификации (обязательные поля, допустимые значения, согласованность)
- **Стек**: `node:http` + `zod` (0 зависимостей frameworks)
- **Контракт**:
  - `POST /validate` → `{ valid: boolean, errors: string[] }`
  - `GET /version` → `{ version: string }`
- **Правила**:
  - Обязательные поля: `category`, `priority`, `responsibleDepartment`
  - Допустимые категории: `вопрос`, `жалоба`, `запрос`, `предложение`
  - Допустимые приоритеты: `low`, `medium`, `high`
  - Согласованность: категория `жалоба` → приоритет не ниже `medium`
- **Изоляция**: отдельный контейнер в docker-compose, без доступа к ключам оркестратора
- **Клиент**: `server/utils/validator-client.ts` — вызов с протоколом прогона

### Каталог компонентов (TZ §9)

- **Расположение**: `config/components/`
- **Компоненты**: LLM, STT, Валидатор
- **Для каждого**: назначение, API, схема входа/выхода, версия, зависимости, ограничения, метрики

### Протокол прогона (TZ §9)

- **Таблицы**: `runs` (прогон), `run_calls` (вызовы компонентов)
- **Запись**: каждый вызов LLM/валидатора → `run_calls` (входы, выходы, длительность, ошибки)
- **Маркировка**: `is_fixture` в `runs`, `FIXTURE:` / `LLM:` в логах
- **Сравнение**: 2 варианта на одном датасете через `server/utils/comparison.ts`

### Расчётный модуль (TZ §5, этап 7)

- **Расположение**: `server/utils/efficiency/` — детерминированный код, LLM не участвует в вычислении
- **Executor**: `'calc'` (`server/queue/calc-executor.ts`) — шаг `efficiency_model` пайплайна
- **Компоненты**:
  - `prng.ts` — seeded PRNG (mulberry32) — детерминизм bootstrap
  - `dataset.ts` — генератор модельного датасета 200 обращений (пометка `simulation`, TZ §15)
  - `stats.ts` — bootstrap CI 95% разницы средних (10 000 ресемплов, фиксированный seed)
  - `model.ts` — формулы (variant_minutes, effect_per_ticket, effect_volume), 3 сценария, чувствительность ±20%
  - `decision.ts` — пороги → автоматическое влияние на рекомендацию (эффект < 0.5 мин → postpone; качество < 85% или CI включает ноль → validate_first)
  - `compute.ts` — оркестрация + warnings
- **Хранение**: таблица `calculations` (model_version, formula, params, seed, input_summary, result, warnings)
- **Воспроизводимость**: тот же вход + seed → битово идентичный результат (тест `compute.test.ts`)

## Версионирование API

Стратегия: **версионирование через URL** (фаза 2+).

```
/api/ideas          # Текущий CRUD + анализ (stage 2-4)
/api/jobs/:id       # Управление задачами очереди (stage 4)
/api/v1/...         # Будущее версионирование (stage 9+)
```

## Конфигурация и безопасность

- **DATABASE_URL**: только через переменные окружения, не хранится в коде
- **API ключи** (routerai.ru): только на сервере, через `NITRO_*` env vars
- **SENTRY_DSN**: через `runtimeConfig`, не хардкод
- **Prompt injection**: текст идеи — данные, а не инструкции (защита на уровне промптов)
- **Файлы аудио**: загружаются на сервер, хранятся временно, удаляются после обработки
- **Pre-commit hooks**: husky + lint-staged запускают `eslint --fix` на каждом коммите

## Скрипты

```bash
# Разработка
pnpm dev                    # Nuxt dev server
pnpm build                  # Production build
pnpm preview                # Local preview

# Проверки (запускать после каждого изменения!)
pnpm lint                   # ESLint
pnpm lint:fix               # ESLint + автофикс
pnpm typecheck              # Type checking (vue-tsc через Nuxt)
pnpm test                   # Vitest (unit + integration)
pnpm e2e                    # Playwright E2E-тесты
pnpm e2e:ui                 # Playwright UI mode

# База данных
pnpm db:migrate             # Применить миграции
pnpm db:down                # Откатить последнюю миграцию
pnpm db:status              # Статус миграций
pnpm db:new <name>          # Создать новую миграцию

# Очередь
pnpm worker                 # Запустить воркер
```

## Пакеты (ключевые зависимости)

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `nuxt` | 4.5.2 | Framework |
| `@langchain/langgraph` | 1.4.14 | StateGraph для пайплайна |
| `@langchain/langgraph-checkpoint-postgres` | 1.0.5 | Checkpointing в Postgres |
| `postgres` | 3.4.9 | SQL-first Postgres driver |
| `pg` | 8.23.0 | node-postgres (только для LangGraph checkpointer) |
| `@sentry/nuxt` | 10.73.0 | Error monitoring (Sentry) |
| `evlog` | 2.28.1 | Structured logging (wide events) |
| `zod` | 4.5.4 | Валидация данных |
| `tsx` | 4.23.13 | TS execution (CLI, worker) |
| `vitest` | 3.2.7 | Unit + integration тесты |
| `@playwright/test` | 1.63.0 | E2E тесты |
| `@playwright/cli` | 0.1.19 | Playwright CLI для AI-агента |
| `husky` | 9.1.7 | Git hooks |
| `lint-staged` | 17.5.0 | Запуск линтера на staged файлах |
| `eslint` | 10.10.0 | Статический анализ |
| `tailwindcss` | 4.3.3 | CSS framework |

## Agent Skills

Проект использует AI-агентов сHTTPRequestOperation скиллами:

```
.agents/skills/
├── analyze-logs              # Анализ логов из .evlog/logs/
├── build-audit-logs          # Аудит-трейлы с evlog
└── review-logging-patterns   # Ревью кода на паттерны логирования

.claude/skills/
└── playwright-cli            # Управление браузером через CLI
```

Правила для агентов — в `AGENTS.md` (включая evlog-конвенции в блоке `<!-- evlog:start -->`).
