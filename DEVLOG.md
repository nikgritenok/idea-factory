# DEVLOG.md — Журнал разработки

## [2026-09-08 / шаг 7a] Расчётный модуль: детерминированный расчёт эффективности
**Запрос:** этап 7 плана — мат. модель (формулы видны), стат. модель (bootstrap/CI, фиксированный seed), 3 сценария, пороги → автоматическое влияние на рекомендацию. Число — из проверяемого кода, не из LLM (TZ §5, AGENTS.md).
**План:** (1) `server/utils/efficiency/prng.ts` — mulberry32; (2) `dataset.ts` — генератор модельного датасета 200 обращений (seed фиксируется, помечено simulation); (3) `stats.ts` — bootstrap CI 95% разницы средних; (4) `model.ts` — формулы + 3 сценария + чувствительность ±20%; (5) `decision.ts` — пороги → рекомендация; (6) `compute.ts` — оркестрация; (7) executor `'calc'` + шаг efficiency_model переключён с 'llm' на 'calc'.
**Результат:**
- `server/utils/efficiency/` — 6 модулей расчётного ядра
- `server/queue/calc-executor.ts` — executor 'calc', пишет расчёт в таблицу `calculations`
- `config/pipeline.ts` — efficiency_model: executor 'calc', PIPELINE_VERSION = 'v2-calc'
- `server/queue/executors.ts` — регистрация 'calc'
- Тесты: `compute.test.ts` — 20 тестов
**Проверка:** `pnpm vitest run server/utils/efficiency/compute.test.ts` — 20/20. Ключевые: воспроизводимость (вход+seed → битово идентичный JSON результата), нулевая база, малая выборка (→ insufficient_data), отрицательный эффект (→ postpone), ухудшение качества (→ validate_first).
**Fixes:** (1) тест «разный seed» изначально предполагал одинаковую точечную оценку — ошибка в предположении: датасет генерируется из seed, разный seed → другая база. Тест переписан под корректное ожидание.

### Что внедрено

**Мат. модель** (формулы хранятся в result, видны в отчёте):
```
variant_minutes = ai_minutes + review_minutes + rework_rate × rework_minutes
effect_per_ticket = mean(base_minutes) − variant_minutes
effect_volume = effect_per_ticket × ticket_count (часов/мес)
quality = ai_correct_rate; порог 0.85, цель ≥ 0.92
```

**Стат. модель:** парный bootstrap 10 000 ресемплов, CI 95%, pDeleterious (доля ресемплов с разницей ≤ 0). Seed — mulberry32, сохраняется в `calculations.seed`.

**Пороги → рекомендация (decision.ts):** правила упорядочены по строгости, худшая выигрывает (стоп-фактор не скрывается баллом — TZ §4): недостаточно данных → insufficient_data; эффект < 0.5 мин → postpone; качество < 85% или CI включает ноль → validate_first.

**Сценарии:** base / favorable (ИИ ×0.7 быстрее, доработка ×0.5) / unfavorable (×1.5, ×1.8, качество −8 п.п.). Чувствительность: ±20% по каждому параметру, отсортировано по влиянию.

### Ключевые архитектурные решения

1. **LLM-роль efficiency_analyst выведена из пайплайна:** шаг стал детерминированным ('calc'). Комментарии к числам даёт критик (получает efficiency-результат на вход). Экономия 1 LLM-вызова на прогон + соответствие AGENTS.md.

2. **Датасет — генератор, не хардкод:** параметры генерации (6 мин, 88%, 8%) из TZ §1 сохраняются вместе с данными (`meta.params`) — честная reproducibility и sensitivity к объёму.

3. **Simulation-пометка:** датасет и предупреждения явно помечены `SIMULATION` (TZ §15: модельные данные — не измерение реального процесса).

## [2026-09-08 / шаг 6] Каталог компонентов + прогоны + валидатор
**Запрос:** реализовать реальные прогоны ИИ-решений с протоколом вызовов, микросервисом-валидатором и сравнением вариантов на одном датасете.
**План:** (1) Микросервис-валидатор (`services/validator/`) — node:http + zod, POST /validate, GET /version; (2) Каталог компонентов (`config/components/`) — LLM, STT, валидатор; (3) Протокол прогона (`server/queue/run-protocol.ts`) — запись в runs/run_calls; (4) Интеграция с воркером — создание run, запись вызовов LLM; (5) Сравнение вариантов (`server/utils/comparison.ts`); (6) Тесты
**Результат:**
- `services/validator/` — микросервис: node:http (2 эндпоинта), Zod-схемы, бизнес-правила, Dockerfile
- `config/components/` — каталог: LLM (routerai.ru), STT (routerai.ru), валидатор (localhost:3001)
- `server/queue/run-protocol.ts` — createRun, recordRunCall, finishRun, withRunCall
- `server/utils/validator-client.ts` — клиент валидатора с протоколом прогона
- `server/utils/comparison.ts` — compareRuns, getRunsForIdea
- Обновлён `server/queue/worker.ts` — создание run, запись вызовов LLM, завершение прогона
- Тесты: `services/validator/src/rules.test.ts` (7 тестов), `config/components/index.test.ts` (8 тестов) — все проходят
**Проверка:** `pnpm vitest run config/components/index.test.ts services/validator/src/rules.test.ts` — 15/15 тестов проходят
**Fixes:** нет (первый проход)

### Что внедрено

**Микросервис-валидатор:** node:http сервер (0 зависимостей frameworks), 2 эндпоинта. Проверяет: обязательные поля, допустимые значения, согласованность (жалоба → приоритет не ниже medium). Изолирован от ключей оркестратора (TZ §11). Dockerfile: node:20-alpine, ~50 MB.

**Каталог компонентов:** 3 компонента в `config/components/` — LLM, STT, валидатор. Для каждого: назначение, API, схема входа/выхода, версия, зависимости, ограничения, метрики.

**Протокол прогона:** каждый вызов компонента = запись в `run_calls` (входы, выходы, длительность, ошибки). Прогон = запись в `runs` (idea_id, variant, component_versions, status, is_fixture). Интеграция с воркером: создание run при начале задачи, запись вызовов LLM, завершение прогона.

**Сравнение вариантов:** 2 прогона на одном датасете. Метрики: среднее время, стоимость, success rate, ошибки, токены. Победитель определяется по success rate и времени.

### Ключевые архитектурные решения

1. **node:http вместо Express/Fastify:** 0 зависимостей, минимальный контейнер (~50 MB), 25 строк кода. Для 2 эндпоинтов frameworks — overkill.

2. **Протокол прогона через withRunCall:** оборачивает вызов компонента, записывает входы/выходы/длительность. Прозрачно для бизнес-логики.

3. **Изоляция валидатора:** отдельный контейнер, без доступа к ключам оркестратора. Демонстрация изоляции выполнения (TZ §11).

4. **Сравнение по success rate:** победитель — вариант с большей долей успешных вызовов. При равенстве — по времени.

## [2026-09-08 / шаг 5] Роли и промпты: LLM-интеграция + валидация ответов
**Запрос:** подключить реальные ИИ-роли к пайплайну анализа, заменив fixture-заглушки. Обеспечить валидацию формата ответов моделей.
**План:** (1) LLM-клиент (`server/utils/llm.ts`) — вызов z-ai/glm-5.3-flash через routerai.ru; (2) Zod-схемы для валидации ответов 6 LLM-ролей (`shared/schemas/roles/`); (3) Конфиги ролей (`config/roles/`) — промпты, параметры, схемы; (4) LLM-исполнитель (`server/queue/llm-executor.ts`) — вызов LLM + Zod-валидация; (5) Обновление pipeline — замена fixture на llm для 6 шагов; (6) Тесты
**Результат:**
- `server/utils/llm.ts` — LLM-клиент: `callLlm(schema, options)` с валидацией через Zod, `callLlmText()` для сырого текста, `LlmError` для ошибок
- `shared/schemas/roles/` — 6 Zod-схем: OrchestratorPlan, StructuredIdea, MarketAnalysis, Strategy, EfficiencyModel, CriticReview
- `config/roles/` — 7 конфигов ролей: system/user промпты, temperature, maxTokens, timeout, retries
- `server/queue/llm-executor.ts` — `createLlmExecutor(roleId)` — вызов LLM с валидацией ответа
- `config/pipeline.ts` — executor: 'llm' для шагов 1-6, 'fixture' для report_build; PIPELINE_VERSION = 'v1-llm'
- `server/queue/executors.ts` — регистрация LLM-исполнителя в registry
- Тесты: `server/utils/llm.test.ts` (8 тестов), `server/queue/llm-executor.test.ts` (3 теста), `config/roles/index.test.ts` (7 тестов) — все проходят
**Проверка:** `pnpm vitest run server/utils/llm.test.ts server/queue/llm-executor.test.ts config/roles/index.test.ts` — 18/18 тестов проходят
**Fixes:** (1) `beforeEach` не импортирован из vitest — добавлен в импорт; (2) Playground-тесты (Playwright, Postgres) не связаны с этим шагом — пропущены

### Что внедрено

**LLM-клиент:** fetch-клиент для routerai.ru (OpenAI-compatible /v1/chat/completions). Поддержка markdown-блоков JSON в ответах модели. Таймауты, повторы, логирование. Валидация ответа через Zod-схему.

**Конфиги ролей:** 7 ролей в `config/roles/` — system prompt (роль + границы + формат), user prompt (шаблон с placeholders), параметры (temperature 0.3–0.5, maxTokens 1024–4096, timeout 60–90s). Каждая роль — отдельный файл с TypeScript-типизацией.

**Валидация ответов:** Zod-схемы для каждого типа ответа (6 схем). Битый ответ модели → `LlmError` → retry (если retries > 0 в pipeline.ts). Маркировка: LLM-прогоны помечаются `LLM:` (не `FIXTURE:`).

**Редактор отчёта:** остаётся fixture (детерминированная сборка, не LLM-роль). Логика сборки описана в `config/roles/report-editor.ts`.

### Ключевые архитектурные решения

1. **LLM-клиент без LangChain.js:** LangGraph.js используется для оркестрации графа, LLM-клиент — простой fetch (без лишней абстракции).

2. **Валидация через Zod:** единый источник правды для форматов ответов. Модель возвращает JSON → парсинг → Zod-валидация → результат или ошибка.

3. **Паттерн «роль → конфиг → промпт → LLM → валидация»:** каждая роль — отдельный конфиг, не смешано с кодом очереди.

4. **Temperature по ролям:** аналитические роли (0.3) vs креативные (0.5). Максимальная предсказуемость для расчётов.

## [2026-09-08 / шаг 7] Observability + E2E Testing: Sentry + evlog + Playwright
**Запрос:** внедрить минимальную инфраструктуру наблюдаемости и тестирования: Sentry (ошибки), evlog (структурированные логи с request_id), Playwright (E2E-тесты), TypeScript typecheck (уже есть)
**План:** (1) `@sentry/nuxt` — модуль с DSN в runtimeConfig, client/server configs; (2) `server/utils/logger.ts` — минималистичный JSON-логгер в stdout (без зависимостей); (3) `server/middleware/request-id.ts` — генерация/проброс request_id через X-Request-Id header; (4) интеграция логгера в `apiError()`; (5) `@playwright/test` — конфиг с Chromium + webServer, e2e/smoke.spec.ts
**Результат:**
- `package.json` — `@sentry/nuxt@10.73.0`, `@playwright/test@1.63.0`, scripts: `e2e`, `e2e:ui`
- `nuxt.config.ts` — модуль `@sentry/nuxt/module`, runtimeConfig: `sentryDsn`, `appEnv`
- `sentry.client.config.ts` — client-side Sentry.init (DSN из runtimeConfig, tracesSampleRate 0.1)
- `sentry.server.config.ts` — server-side Sentry.init
- `server/utils/logger.ts` — `logger.info/warn/error(message, context?, requestId?)` — JSON в stdout
- `server/middleware/request-id.ts` — X-Request-Id: генерация UUID или пропуск существующего
- `server/utils/api/error.ts` — `apiError()` логирует ошибку перед throw
- `playwright.config.ts` — Chromium, baseURL localhost:3000, webServer auto-start
- `e2e/smoke.spec.ts` — 3 теста: homepage loads, meta title, API request-id header
- `.env.example` — `SENTRY_DSN=`, `APP_ENV=development`
- `.gitignore` — `test-results/`, `playwright-report/`
**Проверка:** `npx eslint` на всех новых файлах — 0 ошибок; `pnpm typecheck` — только pre-existing ошибки (worker.ts, ideas.ts, migrate.test.ts — не связаны с этим шагом); Chromium скачан и готов
**Fixes:** нет (первый проход)

### Что внедрено

**Sentry:** `@sentry/nuxt/module` — автоматическая инструментация Nuxt (client + server). DSN через `runtimeConfig` (не хардкод). Source maps заливаются через built-in Vite plugin. Включается в production или при `SENTRY_ENABLED=true`.

**evlog:** Свой JSON-логгер без зависимостей. Формат: `{"timestamp":"...","level":"info","message":"...","request_id":"...","context":{...}}`. Логи идут в stdout — Docker собирает через `docker logs`. Request ID генерируется на каждом запросе (UUID v4) и пропускается дальше если пришёл от клиента.

**Playwright:** E2E-тесты в `e2e/`, Chromium-only. `webServer` в конфиге автоматически поднимает `pnpm dev`. 3 smoke-теста: загрузка главной, meta title, наличие X-Request-Id в API-ответах.

**Стандартная связка для переноса:** Sentry + evlog + Playwright + typecheck — минимальная инфраструктура, которую можно скопировать в любой следующий Nuxt-проект.

## [2026-09-07 / шаг 5] ESLint strict mode + husky + lint-staged
**Запрос:** внедрить жёсткий ESLint-конфиг с type-aware правилами, структурными лимитами, архитектурными границами app↔server, husky pre-commit hook и lint-staged
**План:** объединить два подхода — архитектурные границы (ограничения импортов в app/server, запрет process.env/sql.raw) + жёсткость (no-unsafe-*, max-lines, max-params, switch-exhaustiveness, no-v-html); husky + lint-staged для принуждения на каждом коммите
**Результат:** `eslint.config.mjs` — 7 блоков конфига (type-aware core, general rules, structural limits, app boundaries, server boundaries, overrides for CLI/plugins/tests, vitest); `package.json` — scripts lint/lint:fix с `--max-warnings 0`, lint-staged; `.husky/pre-commit` → `pnpm exec lint-staged`; зависимости: @vitest/eslint-plugin, husky, lint-staged; новый файл `server/queue/worker-utils.ts` (extract helper functions для worker.ts)
**Проверка:** `pnpm lint` — 0 ошибок, 0 предупреждений; `pnpm test` — 34/34 тестов проходят; `pnpm typecheck` — ошибки предсуществующие (Zod v4 API + LangGraph типы), мой коммит исправил одну (`executors.ts:24` — добавлен `role` в тип `StepContext.step`)
**Правки:** 4 цикла исправления: (1) `max-nesting-depth` — не встроенное ESLint-правило, удалено; (2) type-aware правила применялись к .mjs файлам без type-info — разделены на два блока (type-aware только для .ts/.vue); (3) `config/pipeline.ts` не найден project service — добавлен `allowDefaultProject`; (4) `process.env` в серверных файлах (db.ts, stt.ts, helpers.ts, checkpointer.ts) — добавлены исключения для env-слоя; (5) `readBody()` в API возвращал `any` — каст через `as unknown`; (6) `StepContext.step` не содержал `role` — расширен тип; (7) worker.ts 351 строка > 300 лимита — extract в worker-utils.ts + консолидация `recordStepProgress`

### Что внедрено

**Type-aware ядро:** `no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-explicit-any` + семейство `no-unsafe-*`, `switch-exhaustiveness-check`, `consistent-type-imports`

**Гигиена:** `eqeqeq`, `no-eval`, `no-new-func`, `no-console` (warn/error), `no-v-html` (защита XSS от untrusted input идей), Vue-specific правила

**Структурные лимиты:** `max-lines` 300/250, `max-lines-per-function` 80, `max-params` 4

**Архитектурные границы:** запрет postgres/pg/Node builtins/server imports в `app/`; запрет Pinia/window/document/process.env в `server/`; запрет `sql.raw()` в `server/`; запрет деструктуризации store (теряется реактивность)

**Принуждение:** `--max-warnings 0` в scripts + lint-staged на pre-commit → агент не может закоммитить код с ошибками линтера

## [2026-09-07 / шаг 4] Очередь задач + LangGraph-воркер (checkpointing, управление)
**Запрос:** этап 4 плана — постоянный воркер, LangGraph.js state graph, checkpointing в Postgres (PostgresSaver), приоритеты с anti-starvation, пауза/продолжение/отмена/повтор шага/смена приоритета, лимит 10 активных идей, идемпотентность enqueue
**План:** использовать LangGraph.js (отраслевой стандарт) вместо кастомного stateGraph; дождаться стабильного релиза; queue на PostgreSQL (кастомная, не LangGraph — для приоритетов/anti-starvation); PostgresSaver для checkpointing; fixture executor для прототипа (стек 7 шагов из config/pipeline.ts)
**Результат:** `server/queue/` — enqueue, claim, priority, checkpointer, worker (AnalysisWorker с buildGraph/executeJob/streamJob/replayFromCheckpoint), controls (pause/resume/cancel/retryStep/setPriority), executors (fixture + registry), types; API: `POST /api/ideas/:id/run`, `GET /api/jobs/:id`, `POST /api/jobs/:id/{pause,resume,cancel,retry-step}`, `PATCH /api/jobs/:id/priority`; `server/plugins/worker.ts` (WORKER_MODE=true), `server/queue/worker-cli.ts` (npm run worker); package.json: @langchain/langgraph@1.4.14, @langchain/langgraph-checkpoint-postgres@1.0.5, pg@8.23.0
**Проверка:** `pnpm test` — 37 тестов (13 queue + 10 worker + 7 migrate + 5 ideas + 2 stt), все проходят; lint чистый; `pnpm run build` проходит; ручной прогон: curl создаёт идею, enqueue через POST /run, worker обрабатывает 7 шагов → status=done, retry-step с time-travel перезапускает с указанного шага
**Правки:** 4 цикла исправления: (1) vite dev server хостил на 5173 а не 3000 — исправлено на --port 3000; (2) vite dev не подхватывал DATABASE_URL из env — запуск через `DATABASE_URL=... npx nuxi dev`; (3) `graph.invoke(null, historicalConfig)` выбрасывал "Received no input writes for __start__" в тесте retry-step — ошибка была в `target.config` вместо `target` (findCheckpointBefore уже возвращает config, а не snapshot); (4) импорт `beforeAll` потерян из migrate.test.ts при предыдущем автофиксе — добавлен обратно; (5) неправильные импорт-пути в API роутах (`../../../../` вместо `../../../` для файлов на уровне `server/api/jobs/[id]/`)

### Ключевые архитектурные решения

1. **LangGraph.js вместо кастомного stateGraph**: используется `StateGraph` с `Annotation.Root`, типизированный ввод/вывод; `graph.stream(input, config)` для обычного потока, `graph.invoke(null, historicalConfig)` для time-travel replay (唯一 рабочий способ, stream бросает ошибку для завершённых потоков)

2. **Два checkpoint-пула**: основной (`mainCheckpointer`) — для pipeline checkpoints LangGraph (из `server/utils/db.ts`); воркер создаёт свой пул через `createCheckpointer()` из `server/queue/checkpointer.ts` — оба указывают на одну БД, но независимы для изоляции

3. **Queue vs LangGraph checkpointing**: кастомная очередь (`queue_jobs`) — для приоритетов, anti-starvation, лимита 10 идей; LangGraph checkpointing — для восстановления состояния графа (values + next node). Это стандартный паттерн (pg-boss, bullmq).

4. **Fixture executor**: реестр исполнителей (`registerExecutor`) позволяет подключать реальные ИИ-вызовы на этапе 5; fixture-реализация делает `FIXTURE: Orchestrator step` за 50ms с имитацией checkpoint state

5. **Одна задача**: воркер берёт только одну задачу из очереди (не параллелизм всех 10), работает пока не остановлен (persistent worker, TZ §8)

## [2026-09-07 / шаг 3] Голос → карточка: STT + API идей
**Запрос:** этап 3 плана — запись аудио, реальная расшифровка через routerai STT, текстовый fallback, лимиты
**План:** server utils `stt.ts` (multipart → /api/v1/audio/transcriptions, model=microsoft/mai-transcribe-2, language=ru), API `POST /api/transcribe` (лимиты 25 МБ / 10 мин, пустая расшифровка → ok:false с сообщением), API `GET/POST /api/ideas` (лимит 10 активных, title из первого предложения ≤120 симв., v1 в idea_versions)
**Результат:** `server/utils/{stt,db,ideas}.ts`, `server/api/transcribe.post.ts`, `server/api/ideas/index.{get,post}.ts`
**Проверка:** реальный прогон STT: TTS-сэмпл 11 сек русского текста → расшифровка слово в слово (0.034 ₽); независимый файл (Гагарин «Поехали») → реальный ответ API. E2E на dev-сервере: создание идеи 201 + v1 в истории, пустой ввод 400, STT через /api/transcribe вернул текст, лимит: 10×201 затем 409. `npx vitest run` — 14 тестов
**Правки:** циклы исправлений: (1) Rollup не резолвил `../utils/ideas` из вложенной `api/ideas/` → `../../utils/ideas`; (2) мисматч длины обрезки заголовка в тесте и коде (117/119 + «…») → зафиксирован контракт 120 симв. включая «…»

## [2026-09-07 / шаг 2] Инфраструктура БД: docker-compose, схема, миграции
**Запрос:** этап 2 плана — docker-compose (db/web/worker), postgres:16, схема БД (карточки, версии, аудио, источники, прогоны, расчёты, очередь, конфиги), миграции вверх/вниз
**План:** миграции как SQL-файлы + собственный раннер (postgres.js), схема покрывает TZ §2 (поля карточки), §6 (данные пайплайна), §8 (очередь с checkpoint), §9 (прогоны + журнал вызовов); тестовая БД в docker на порту 5434
**Результат:** `server/db/migrations/0001_initial.{up,down}.sql` (12 таблиц), `server/db/migrate.ts` (раннер), `server/db/migrate-cli.ts` (CLI), `server/plugins/db-migrate.ts` (автомиграции на старте web), `Dockerfile`, `docker-compose.yml` (db/web/worker/validator), `README.md`, `.env.example` дополнен
**Проверка:** `pnpm test` — 7 тестов: up создаёт все таблицы, down удаляет, idempotent по журналу, данные переживают переподключение, констрейнты воронки/приоритетов, каскадное удаление; CLI status/down/up реально выполнены на тестовой БД; `pnpm run build` проходит; `docker compose config` валиден
**Правки:** 3 цикла исправления: (1) мусорная строка в SQL миграции удалена до применения; (2) раннер применял down-файлы как миграции (фильтр `\.sql$` → `\.up\.sql$`) — найден реальным прогоном, добавлен тест; (3) в тесте не был импортирован `beforeAll`, и postgres.js не принимает multi-command в prepared statement (`sql.unsafe` для reset)

## [2026-09-07 / шаг 1] FLOWS.md — карта экранов и состояний
**Запрос:** этап 1 плана — карта 7 экранов × 6 состояний (§7a TZ) + доступность
**План:** на основе списка экранов §7a TZ и DESIGN.md сгенерировать FLOWS.md: для каждого экрана таблица 6 состояний (начало/успех/пусто/ожидание/ошибка/восстановление), сценарии с явными проверками (микрофон, длинные названия, 390px, клавиатура)
**Результат:** `FLOWS.md` — 7 экранов, у каждого 6 состояний + сценарии; общие принципы состояний и доступности; матрица явных проверок из §7a
**Проверка:** все экраны из §7a TZ покрыты (воронка, новая идея, карточка, ход работы, отчёт, прогоны, настройки+документация); все 5 явных проверок из TZ присутствуют в матрице
**Правки:** нет

## [2026-09-07 / шаг 0] Концепция: заполнение §1 TZ.md
**Запрос:** этап 0 плана — заполнить §1 TZ.md (идея, Job Statement, Job Stories, допущения), ревизия полноты §2
**План:** перенести зафиксированные решения из PLAN.md в TZ.md §1 (идея разбора обращений, метрики, LLM+STT через routerai, валидатор правил как микросервис), добавить Job Statement, 3 Job Stories, ревизию полноты §2, допущения в §15
**Результат:** TZ.md §1 заполнен, добавлены разделы Job Statement / Job Stories / Ревизия полноты §2, §15 дополнен допущением о брендбуке и реестром допущений по расчёту
**Проверка:** идея сквозного сценария соответствует PLAN.md; все поля карточки §2 покрыты артефактами пайплайна (проверено текстом ревизии)
**Правки:** нет

## [2026-09-06] Подключение Tavily MCP
**Запрос:** включить Tavily MCP для веб-поиска
**План:** проверить конфиг opencode, найти API-ключ в bashrc, прописать в глобальный конфиг
**Результат:** ключ прописан напрямую в `~/.config/opencode/opencode.jsonc` ( вместо `{env:TAVILY_API_KEY}` который не резолвился)
**Проверка:** `list_mcp_resources` — Tavily не показывает ресурсы (только тулзы), но тулзы `tavily_tavily_search`, `tavily_tavily_extract`, `tavily_tavily_crawl`, `tavily_tavily_map`, `tavily_tavily_research` доступны в списке инструментов
**Правки:** нет

## [2026-09-06] Подключение провайдера RouterAI (z-ai/glm-5.3-flash)
**Запрос:** настроить opencode на модель `z-ai/glm-5.3-flash` через routerai.ru
**План:** проверить эндпоинты через API (`/v1/models/{author}/{slug}/endpoints`), выбрать провайдера (Novita — лучшая цена 9.29/30.95 ₽ за 1M + полный набор параметров), добавить кастомный провайдер в `opencode.json` через `@ai-sdk/openai-compatible`
**Результат:** провайдер `routerai` прописан в `opencode.json` (baseURL `https://routerai.ru/api/v1`), создан `.env.example`, ключ экспортирован в `~/.bashrc`
**Проверка:** curl к `/v1/chat/completions` вернул HTTP 200 и осмысленный ответ модели (55 токенов). Первый запуск в opencode дал `401 Unauthorized` — `{env:ROUTERAI_API_KEY}` не резолвится в поле `apiKey` провайдера
**Правки:** ключ прописан напрямую в `opencode.json`, файл добавлен в `.gitignore` (секрет не попадёт в репозиторий). Цикл исправления бага: 401 → замена env-ссылки на прямой ключ → перезапуск

## [2026-09-08 / шаг 6] API governance + shared schemas + feature-based organization
**Запрос:** внедрить минимальный API governance (20% → 80%) для AI-first разработки: единый формат ошибок, общие схемы, feature-based organization
**План:** 3 изменения: (1) `shared/schemas/` — перенести Zod-схемы из `server/utils/schemas.ts` как единый источник правды; (2) `server/utils/api/error.ts` — apiError() helper с единым error envelope `{ error: { code, message, details? } }`; (3) AGENTS.md — API rules для AI-агента (validate→service→return, error format, naming). Бонус: feature-based organization в `app/features/` через AGENTS.md + conventions.md + ARCHITECTURE.md
**Результат:**
- `shared/schemas/index.ts` — все Zod-схемы (IdeaRow, JobRow, PipelineStep, API request/response, helpers)
- `server/utils/schemas.ts` — re-export для обратной совместимости существующих импортов
- `server/utils/api/error.ts` — `apiError(status, code, message, details?)` + `fromServiceError()`
- `AGENTS.md` — секция "API rules" (error format, route handler pattern, input validation, naming, response format) + секция "Feature-based organization"
- `docs/conventions.md` — обновлена структура проекта, добавлены правила feature folders
- `docs/ARCHITECTURE.md` — обновлена структура проекта
- Исправлена Zod v4 совместимость: `errorMap` → `error`, `SafeParseReturnType` → явный return type
**Проверка:** `pnpm lint` ✅ (0 errors), `pnpm typecheck` — только pre-existing ошибки (worker.ts, migrate.test.ts, ideas.ts), `pnpm test` ✅ (34/34)
**Fixes:** Zod v4 API changes — `errorMap` не существует, заменён на `error`; `z.SafeParseReturnType` не экспортируется, заменён на явный union type
