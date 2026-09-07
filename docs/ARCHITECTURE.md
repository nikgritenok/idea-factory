# ARCHITECTURE.md — Стек и архитектура проекта

## Стек технологий

| Слой | Технология | Назначение |
|------|-----------|------------|
| Framework | Nuxt 4.5 (Nitro) | Full-stack SSR/CSR, файловый роутинг, server routes |
| Language | TypeScript | Строгая типизация, общая кодовая база |
| ORM | postgres.js | Лёгкий SQL-first драйвер для PostgreSQL |
| Database | PostgreSQL 16 | Основная реляционная БД (схема в `server/db/migrations/`) |
| Validation | Zod | Валидация данных на границах (API, route params, env vars) |
| AI/Orchestration | LangGraph.js 1.4 + PostgresSaver | StateGraph для пайплайна анализа, checkpointing в Postgres |
| State | Pinia | Управление состоянием на клиенте |
| Build | Vite 8 | Сборка клиентской части |
| Package manager | pnpm | Управление зависимостями |
| Linting | ESLint + @nuxt/eslint + stylistic | Статический анализ кода |
| Testing | Vitest | Unit-тесты, интеграционные тесты |
| Runtime | Node.js (LTS) | Серверный рантайм |
| Language Runtime | tsx | Запуск .ts файлов (CLI worker, миграции) |

## Структура проекта

```
app/                  # Frontend (Vue 3)
  components/         # UI-компоненты
  composables/        # Переиспользуемая логика
  pages/              # Файловый роутинг
  layouts/
  middleware/
  utils/
  stores/             # Pinia-сторы

server/               # Backend (Nitro)
  api/                # API-маршруты (auto-imported by Nitro)
    ideas/            # CRUD идей + запуск анализа
    jobs/             # Управление задачами очереди
  db/                 # Миграции БД, CLI для миграций
  queue/              # Очередь задач + LangGraph-воркер
    checkpointer.ts   # PostgresSaver (LangGraph checkpointing)
    worker.ts         # AnalysisWorker — LangGraph StateGraph
    worker-cli.ts     # CLI для запуска воркера
    enqueue.ts        # Идемпотентная постановка в очередь
    claim.ts          # Claim задач из очереди
    controls.ts       # Pause/resume/cancel/retry-step/setPriority
    executors.ts      # Реестр исполнителей шагов (fixture для прототипа)
    priority.ts       # Anti-starvation формула
    types.ts          # Интерфейсы очереди
  plugins/            # Nitro-плагины (worker при WORKER_MODE=true)
  utils/              # Утилиты сервера
    db.ts             # Синглтон postgres.js
    ideas.ts          # Хелперы для ideas, лимит 10 активных
    stt.ts            # STT через routerai.ru (для этапа 5+)

config/               # Конфиги пайплайна (steps, лимиты, очереди)

docs/                 # Документация
  ARCHITECTURE.md     # Этот файл
  conventions.md      # Код-стайл и правила
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

### Очередь и воркер (TZ §8)

- **Очередь**: кастомная на PostgreSQL (`queue_jobs`), поддержка приоритетов (high/medium/low), anti-starvation, лимит 10 активных идей
- **Воркер**: LangGraph.js `StateGraph` с `Annotation.Root`, checkpointing через `@langchain/langgraph-checkpoint-postgres` (`PostgresSaver`)
- **Состояние на сервере**: закрытие вкладки не останавливает выполнение; перезапуск воркера продолжает с последнего чекпоинта
- **Управление**: пауза/продолжение/отмена/повтор шага/смена приоритета — через API (`/api/jobs/:id/*`)
- **Режимы запуска**: 
  - `WORKER_MODE=true` — Nitro-плагин запускает воркер в фоне (docker-compose worker service)
  - `pnpm run worker` — standalone CLI (`worker-cli.ts`)
- **Executor Registry**: плагинная архитектура исполнителей шагов (`registerExecutor`), fixture-реализация для прототипа, реальные ИИ-вызовы подключаются на этапе 5

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

### LangGraph.js — детали

- **Версия**: 1.4.14 (текущая стабильная)
- **Checkpointing**: `@langchain/langgraph-checkpoint-postgres@1.0.5` через `pg.Pool`
- **Паттерн time-travel**: `graph.invoke(null, historicalConfig)` для replay с исторического чекпоинта
- **Примечание**: `graph.stream(null, config)` выбрасывает ошибку для已完成ных потоков; для time-travel используется `invoke`
- **Anti-starvation**: формула `basePriority × 10 - attempts × 2 + ageInCycles × 0.5`, clamp 0–100

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
- **Prompt injection**: текст идеи — данные, а не инструкции (защита на уровне промптов)
- **Файлы аудио**: загружаются на сервер, хранятся временно, удаляются после обработки

## Пакеты (ключевые зависимости)

| Пакет | Версия | Назначение |
|-------|--------|------------|
| `nuxt` | 4.5.2 | Framework |
| `@langchain/langgraph` | 1.4.14 | StateGraph для пайплайна |
| `@langchain/langgraph-checkpoint-postgres` | 1.0.5 | Checkpointing в Postgres |
| `postgres` | 3.4.5 | SQL-first Postgres driver |
| `pg` | 8.23.0 | node-postgres (только для LangGraph checkpointer) |
| `tsx` | 4.21.3 | TS execution (CLI, worker) |
| `vitest` | 3.2.4 | Тесты |
| `@vue/test-utils` | 2.4.6 | Vue-компонент тесты |
| `happy-dom` | 18.0.1 | DOM simulation для тестов |
