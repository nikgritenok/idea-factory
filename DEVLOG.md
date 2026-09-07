# DEVLOG.md — Журнал разработки

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
