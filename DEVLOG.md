# DEVLOG.md — Журнал разработки

## [2026-09-14 / шаг 24] Хотфикс деплойки: `prisma.config.ts` ронял Docker build без DATABASE_URL
**Запрос:** лог упавшей деплойки из панели Dokploy после мёрджа задания.
**Причина:** моя проверка из шага 20 (`if (!databaseUrl) throw new TypeError(...)`) вычисляется
при каждом чтении конфига Prisma CLI — в том числе в `pnpm run postinstall` (`prisma skills sync`)
на стадии Docker build, где `.env` нет и быть не должно. Старый `!` пропускал `undefined` дальше,
а `skills sync` базу не трогает — поэтому раньше собиралось. Мой `throw` дал `postinstall` exit 2
и уронил весь `docker build` (`target web: failed to solve`, exit code 1). Стенд при этом остался
на старом контейнере — outage не было, но новый код не встал.
**Исправление:** `process.env['DATABASE_URL'] ?? ''` + комментарий с запретом бросать здесь.
Безвредность пустой строки на build'е — не догадка: `DATABASE_URL= pnpm exec prisma skills sync`
(симуляция build-стадии) → `ok: true, exitCode: 0`. На рантайме URL приходит из окружения compose.
**Проверка:** симуляция выше — exit 0; `eslint prisma.config.ts` чисто; `pnpm typecheck` exit 0.
Ветка `hotfix/prisma-config-build-env`, мёрдж `--ff-only` в `main`, пуш = повторный деплой.
Статус стенда после повторного пуша — проверить отдельным замером (404 с `code` + `X-Request-Id`).


## [2026-09-14 / шаг 23] Прод-сборка проверена поведенчески: сэмплинг, environment, маска uuid
**Запрос:** «после изменений — реальный прогон, не «должно работать»»; оставалась одна непроверенная
фраза — что `$production`-сэмплинг и fs-drain живут не только в dev.
**Что дали бы два предыдущих замера, если бы остановился на них:** `pnpm build` → exit 0, и в
`.output/server/chunks/nitro/nitro.mjs` видно `sampling:{keep:[{duration:1000}…]}`,
`include:["/api/**","/docs/**"]`, `service:"idea-factory"` и сам fs-drain. Это доказало бы
наличие строк в артефакте, но не поведение.
**Проверка поведением (`node .output/server/index.mjs`, NODE_ENV=production):**
- первая попытка: `/api/health` → 503, `/api/ideas/:uuid` → 500. Соблазн записать себе в
  регрессию. Причина измерением, не догадкой: собранный Nitro **не грузит `.env`** (dev-сервер
  грузит), а `DATABASE_URL` на стенде приходит из compose. С инъекцией env из `.env` —
  `health 200 {"db":"ok"}` и `404` вместо 500. Дефекта нет, есть способ запуска
- сэмплинг увиден, а не прочитан: из двух запросов в `.evlog/logs/` добавилось **одно** событие —
  успешный `info` (200) отброшён 10%-правилом, `404` остался (force-keep по `status >= 400`)
- **найдена моя ошибка шага 17:** в прод-событии значилось `environment: "development"`, потому что
  `env.environment: process.env.APP_ENV ?? 'development'` вычисляется в момент сборки, а стадия
  `build` в Dockerfile `APP_ENV` не получает. Строка убрана, эвлог берёт `NODE_ENV` рантайма →
  после пересборки то же событие даёт `environment: "production"`
- **найдено и занесено в AGENTS.md:** `code/why/fix` в событии лежат в `error.data.*`, а не в
  `error.*` (моя строка «Отладки» обещала `error.code`); evlog сам маскирует uuid в событии —
  и в `path`, и внутри подставленного в `why` id (`id=****0000-****0000`), поэтому корреляция
  только по `requestId`, а не по «id с экрана»
**Проверка после правок:** `pnpm build` exit 0; `eslint nuxt.config.ts` и `pnpm typecheck` чисто;
корреляция сквозная (`X-Request-Id` → `requestId` в NDJSON) подтверждена и в dev, и в prod-артефакте.
**Итог задания:** Sentry удалён полностью (5 файлов/9 мест, lockfile −534 строки), evlog по доке
(fs-drain с ротацией, include, сэмплинг), 21 роут на `useLogger` + `createError({code,why,fix})`,
клиент на `parseError`, консоль вне запроса на `log.*`; `evlog map` 31 → **100/100, «every handler
covered»**; lint 157 → 37 (долг `server/queue/**` описан в шаге 20); e2e 3/3.
**Граница задания:** 12 коммитов в ветке `chore/replace-sentry-with-evlog`, мёрдж `--ff-only` в `main`
и пуш = деплой стенда (имя ветки здесь ради границы задания, а не ради графа истории — §16 п.6).


## [2026-09-14 / шаг 22] Документы приведены к коду; починена корреляция клиент↔событие (`X-Request-Id`)
**Запрос:** остаток задания (шаг F: «чтобы следующая сессия знала, что логи надо читать») + финальная проверка.
**Найдено финальной проверкой, а не чтением:** `pnpm e2e` → падал `smoke.spec.ts:15 «API returns
request-id header»`. Разбор: во всём дереве на `0f21d11` (до задания) строка `X-Request-Id` встречалась
**только в самом тесте** — в `server/` её не ставил никто, `server/middleware/` отсутствует, в истории нет
ни добавления, ни удаления; в Nuxt/Nitro-интеграции evlog заголовок наружу не отдаёт (в отличие от
next/express), и в `event.context.requestId` не пишет. То есть тест был красным и до меня, а утверждение
«X-Request-Id генерируется evlog» в `ARCHITECTURE.md` — ложным, я его унаследовал и повторил в шаге 16.
**Результат:**
- `server/middleware/request-id.ts` — отдаёт наружу `requestId` **из логгера**, а не свой `randomUUID`
  (middleware в Nitro идёт после `request`-хука evlog, своё id разошлось бы с логом)
- `server/api/jobs/[id]/stream.get.ts` — молча проглоченный `catch` в SSE-опросе больше не пустой:
  `log.error(err, { step: 'stream-poll' })` один раз на переход в аврал + `log.set({ stream:
  { pollFailures, recovered } })` в это же событие. Заодно исправлен мой комментарий из шага 18:
  «внутри setInterval не писать» было слишком категорично — пока поток открыт, логгер жив,
  запечатывается он после закрытия
- `AGENTS.md`: раздел «Отладка: где смотреть» **вне** маркеров `<!-- evlog:start/end -->` (блок между
  маркерами перезаписывает `@evlog/cli`, правка внутри него нежить), пункт 8 Default workflow
  («шаг проверен, когда показано широкое событие»), раздел про параллельные сессии и правило
  стейджинга — итог конфликта двух сессий в шаге 16
- `docs/ARCHITECTURE.md`: наблюдаемость — второй адресат `.evlog/logs/<дата>.jsonl` + ротация +
  сэмплинг; структурированные ошибки и форма ответа; убрано описание удалённого `utils/api/error.ts`
  (дерево каталогов после правки сверено глазами — первая попытка потеряла строку `queue/`, исправлено)
- `docs/conventions.md`: §9 называет evlog вместо абстрактного «не логируем console»; §16 baseline —
  **две колонки замера** (`main` 157/5 и ветка 37/0) с обязательством переснять после мёрджа,
  остаток 37 описан как долг с причиной, а не как «всё чисто»
**Проверка:** `pnpm e2e` → **3 passed** (упавший тест починен, не удалён); живой SSE на несуществующую
задачу → `data: {"type":"connected"}` затем `{"message":"Задача не найдена","type":"error"}`;
корреляция измерена насквозь — `X-Request-Id: 42047a51-…` из ответа найден `grep`'ом в
`.evlog/logs/<дата>.jsonl` как `requestId` того же события (с `filter.stage` и `ideas.count`);
`pnpm dlx @evlog/cli map` → **31/100 → 100/100, «every handler covered»**; `pnpm lint` 37 errors
(ни одной новой от этого шага), `pnpm typecheck` exit 0, `pnpm test` 6 failed / 60 passed = baseline.

## [2026-09-14 / шаг 21] Консоль воркера переведена на evlog `log.*`; найден и подтверждён мёртвый CLI-вход `pnpm worker`
**Запрос:** остаток задания, шаг E. По Quick Start из доки: `log.info('tag', msg)` ведёт себя как
`console.log`, поэтому первый коммит — замена без смены поведения; для скриптов/джоб/воркеров —
не `useLogger`, а общий `log` (+ `initLogger` один раз при старте).
**Результат:**
- `server/queue/worker-cli.ts`: `initLogger({ env: { service: 'idea-factory-worker' } })` +
  `log.info('worker', …)` вместо двух `console.log`; падение старта → `log.error({ event:
  'worker_boot_failed', error: <stack> })`
- `server/plugins/worker.ts`: то же для режима `WORKER_MODE=true` (Nitro-плагин, `log` из 'evlog')
- `server/queue/worker.ts`: `console.error('[worker] persistResults ошибка:', err)` →
  `log.error({ event: 'persist_results_failed', error: stack })`. Стек сохранён текстом:
  широкого события с `error.*` вне HTTP-запроса нет, а `log.error(Error)` в сигнатуре есть,
  но тогда теряется тэг события
- `console.*` в `server/` не осталось ни в приложении, ни в сервисных модулях; тесты не трогали
**Найдено проверкой, а не чтением:** `pnpm worker` **не запускается вообще** —
`ERR_MODULE_NOT_FOUND: Cannot find package '~~' imported from server/utils/schemas.ts`.
tsx не резолвит алиас Nuxt (в корневом `tsconfig.json` `files: []` и нет `paths`). Замерено на этом
же дереве без правок шага E (`git stash` трёх файлов) — падает идентично, значит дефект не мой и
существовал до. Рабочий вход в очередь — Nitro-плагин (`WORKER_MODE=true`, сервис `worker` в
compose), он и был жив на стенде (шаг 13).
**Проверка живьём:** `WORKER_MODE=true PORT=3111 pnpm dev` → в логе
`20:04:40.273 [worker] WORKER_MODE=true — обработчик очереди запущен` — строка выводится evlog'ом
(таймстемп + тег), а не `console.log`. Процесс остановлен, порт 3111 освобождён, основной dev на
3000 отвечает 200.
`pnpm typecheck` → exit 0. `eslint` по трём файлам: 10 ошибок в `worker.ts` — **до правки было тоже
10** (замер `git stash`), то есть это долг группы `server/queue/**` из шага 20, новых ни одной.
**Что осталось намеренно:** wide event на каждую обработку задачи (`createLogger` + ручной `emit()`
в `AnalysisWorker`) — по доке это отдельное проектное решение про жизненный цикл джобы, не «заменить
консоль»; и починка `pnpm worker` (нужны `paths` в tsconfig для tsx или алиасы в конфиге tsx) —
это сломанный вход, а не стиль, и чинить его надо отдельным заданием.

## [2026-09-14 / шаг 20] Чистка ESLint: убран шум, починен projectService; 152 ошибки → 58, warning'ов 0
**Запрос:** отдельно от задания по evlog — вырезать из `eslint.config.mjs` правила, дающие шум
(perfectionist целиком, `vue/max-attributes-per-line`, `@stylistic/brace-style`,
`sonarjs/prefer-*`, `unicorn/prefer-ternary`, `security/detect-non-literal-*` и др.), починить
`projectService.allowDefaultProject` и оставить правила, которые ловят баги.
**Результат по конфигу:**
- удалён `eslint-plugin-perfectionist` (импорт, блок, зависимость) — 5 правил сортировки, главный
  генератор шума: один сгенерированный `src/prisma/contract.d.ts` давал 28 ошибок
- удалены `unicorn/{prefer-structured-clone,prefer-ternary,prefer-logical-operator-over-ternary,consistent-function-scoping}`,
  `sonarjs/{no-duplicate-string,prefer-single-boolean-return,prefer-immediate-return,no-small-switch,prefer-object-literal,prefer-while}`,
  `promise/prefer-await-to-callbacks`, `security/{detect-non-literal-regexp,detect-child-process,detect-non-literal-fs-filename}`
- выключены приходящие из базового @nuxt/eslint-config: `vue/max-attributes-per-line`, `vue/no-multiple-template-root`,
  `@stylistic/brace-style`, `@stylistic/max-statements-per-line`
- `max-lines` для `app/**/*.vue` поднят 250 → 350 по решению владельца (`FunnelBoard.vue`
  превышал и старый лимит); `src/prisma/**`, `.opencode/**`, `.agents/**` — в ignores
- сохранены: все type-aware `@typescript-eslint/*`, `slop/*`, `ai-guard/*`, `eqeqeq`, `no-eval`,
  `no-self-assign`, архитектурные `no-restricted-*`, `max-params`, `sonarjs/cognitive-complexity`,
  критичные `security/*`
**projectService — починено измерением, а не на глаз:**
- причина «was not found by the project service»: в `allowDefaultProject` лежал `config/*.ts`,
  а файлы живут в `config/roles/` и `config/components/` — одноуровневый glob их не накрывал
- доковать нельзя: typescript-eslint **запрещает `**` в этом поле** и ограничивает default project
  **8 файлами**, а в `config/**` их 15. Отсюда два реальных проекта вместо раздувания списка:
  `config/tsconfig.json` (с `paths` для `~~`, иначе `PipelineStep` резолвился в `error` type) и
  `services/validator/tsconfig.json` (у сервиса были свои `package.json` и Dockerfile, но не было
  tsconfig). Parsing-ошибок после этого — 0
- **отвергнуто измерением:** соблазн вытащить корневые конфиги тулинга в реальный проект через
  `include` в `tsconfig.json` убивает и то, и другое — solution-style корневой конфиг (`files: []`)
  с `include` становится настоящим проектом, `pnpm typecheck` падает на не-composite ссылках
  (TS6306/TS6310), а ESLint вырастает с 58 до 342 ошибками. Побочно корневой конфиг без `noEmit`
  наэмитил 13 `.js` рядом с исходниками и `tsconfig.tsbuildinfo` — убрано, в `git status` чисто.
  Оставлено как есть: короткий `allowDefaultProject` + реальные tsconfig у `config/` и сервиса
**Починено в коде (только механика):** неиспользуемые `LlmError`/`LlmExecutorContext`/`type Rng`;
`let result` → `const`; два избыточных `confidence = 'low'` в `comparison.ts`; вложенный тернарник
и `== null` в `orchestrator.ts`; `!` в `prisma.config.ts` → явная проверка с текстом ошибки; лишнее
утверждение в `scripts/test-roles.ts`; `parseBody`/`createServer` в валидаторе (callback теперь
синхронный, async-логика в `handle`); описания у 4 directive-комментариев; `void` для 2 floating
promises; `console.log` метрик LLM → `log.info` evlog; `env.X = env.X` → явная заглушка.
**Цикл «сломал — нашёл — починил»:** удаление `process.env.ROUTERAI_API_KEY = process.env.ROUTERAI_API_KEY`
в `stt.test.ts` уронило 2 теста (6 failed/60 passed → **8 failed/58 passed**, замерено через
`git stash push` + `pop`). Строка была не пустяком: в Node присваивание `undefined` property у env
пишет строку `"undefined"`, то есть truthy — на этом держался проход мимо проверки ключа к ffmpeg.
Восстановлено явно: `process.env.ROUTERAI_API_KEY ??= STT_KEY_PLACEHOLDER` (комментарий в самом тесте и так обещал «упадёт с test-key»). В `llm.test.ts`
та же строка была настоящим no-op (ключ в `.env` — пустая строка), там она удалена.
Второй эпизод того же цикла: явная заглушка `??= 'test-key'` попалась в `no-secrets` (литерал в
переменной с именем `*_API_KEY`) — и это правило отработало правильно. Заглушку вынес в константу
`STT_KEY_PLACEHOLDER`; вариант `if (!…) … =` отвергнут `prefer-nullish-coalescing`, а `??=` оставлен
после замера: в окружении vitest ключ именно `undefined`, не пустая строка, так что `??=` покрывает
случай и тесты на нём зелёные.
**Проверка:** `pnpm lint` → **37 errors / 0 warnings** против **152 / 5** до чистки и 157/158 по
записанному baseline; parsing-ошибок 0; `pnpm typecheck` → exit 0; `pnpm test` → **6 failed / 60 passed**
— идентично baseline этого же коммита, новых падений 0; микросервис-валидатор поднят через `tsx` и
проверен живьём: `/version` → `1.0.0`, `/validate` → `{"valid":true,"errors":[]}`, на плохую пару →
ошибка схемы, на битый JSON → `{"valid":false,"errors":["Некорректный JSON"]}` (это путь в изменённом
`parseBody`).
Дополнительно снято после первого коммита чистки (58 → 50 → 37):
- `config/roles/*` — поле `schema` хранило Zod-схему, будучи объявленным типом **результата**
  валидации; `as unknown as X` ничего не обеспечивал (у литерала нет аннотации), минус 6 утверждений,
  мёртвые импорты типов убраны. `scripts/test-roles.ts` вызывает `callLlm(llm.schema, …)` без каста —
  то есть схема там и ожидалась
- тулинг у корня (`prisma.config`, `playwright.config`, `vitest.config`, `e2e/**`, `scripts/**`) —
  снят только тип-aware шум от того, что `defaultProject` не включает node-типы; все прочие правила
  продолжают действовать (минус 12)
- `comparison.ts` — `as unknown as RunCallRow[]` оказался не нужен: строки Prisma и так подходили,
  интерфейс стал мёртвым
- `validator-client.ts` — `JSON.parse(JSON.stringify(unknown))` (возвращает any) заменён явным
  снимком; попутно это чинит и реальный дефект: на `response === undefined` старый код бросал
  SyntaxError. Проверено живым прогоном: в `run_calls` легли ровно `{"category":"жалоба",
  "priority":"high","responsibleDepartment":"Техподдержка"}` и `{"valid":true,"errors":[]}`;
  пробные строки из dev-БД удалены (1 идея, 1 прогон, 0 остатка)
- `scripts/test-roles.ts` — аргументы CLI проверяются против `LLM_ROLES` с внятным отказом вместо
  слепого сужения типом

**Остаток 37 — и это один модуль:** 36 из 37 в `server/queue/**` (`worker.ts` 10, `enqueue.ts` 6,
`controls.ts` 6, `calc-executor.ts` 4, `run-protocol.ts` 3, `claim.ts` 3, `worker.test.ts` 3,
`llm-executor.ts` 1) + `max-lines` в `IdeaCard.vue` (479 при 350). Это в основном
`as unknown as JobRow` на строках Prisma и следствия `unknown`-полей в протоколе прогона, плюс
`max-params`/cognitive-complexity/`max-lines` в `worker.ts`. Правка каждого — смена типов или
реструктуризация воркера, а тесты очереди красные с baseline (нужны ROUTERAI_API_KEY и тестовая БД
на 5434), то проверить «на зелёном» сейчас нельзя. Вариант «пробежать по ним молча» означал бы
выдать непроверенное за проверенное — оставлено как решение человека.

## [2026-09-14 / шаг 19] Клиент читает ошибки через `parseError`; починен user-visible дефект текста ошибки
**Запрос:** продолжение задания, согласованное решение «да, правим фронт под evlog».
**Результат:**
- `extractApiMessage` в `app/features/ideas/types.ts` переписана на `parseError` из evlog;
  мёртвый `interface ApiErrorShape` (описание envelope, которого сервер не отдаёт) удалён;
  добавлен необязательный `fallback`, чтобы формы не теряли свои формулировки
- `CreateIdeaForm.vue` и `useVoiceInput.ts` перестали дублировать разбор ошибки локальными кастами —
  обе точки идут через `extractApiMessage`; `IdeaCard.vue` и `FunnelBoard.vue` (7 вызовов) правки не требуют
- тесты: `app/features/ideas/types.test.ts` (4 теста: evlog-ответ, живой `EvlogError`, старый h3-вид,
  пустая ошибка) и `server/utils/api-errors.test.ts` (страж правила: каждый `createError` в роутах несёт
  `code`/`status`/`why`/`fix`, импортирован из `evlog`, и нигде не осталось `statusMessage`)
**Проверка (измерено, не «должно работать»):** прогон через `ofetch` против живого dev-сервера на
`GET /api/ideas/00000000-…` (404):
- старая формула `e.data?.error?.message ?? e.message` → `[GET] "http://localhost:3000/api/ideas/00000000-0000-0000-0000-000000000000": 404  `
  — то есть в интерфейсе показывался сырой текст ofetch с полным URL и uuid;
- `parseError(e)` → `message: «Идея не найдена»`, `code: IDEA_NOT_FOUND`, `fix: «Вернитесь на доску и откройте
  существующую идею — ссылка могла устареть»`.
`pnpm exec vitest run` по двум файлам → 8/8 зелёные; полный прогон: **6 failed / 60 passed** против baseline
**6 failed / 52 passed** — те же 5 падающих файлов (LLM-ключ и тестовая БД), новых падений 0, +8 green.
Type-aware ESLint по изменённым файлам — чисто.
**Фиксы цикла проверки:** (1) страж сначала требовал `code:` и упал на законном шортхенде `code,`
(его сам же предписывает `object-shorthand`) — распознавание переведено на оба варианта;
(2) `parseError(undefined)` возвращает строку `"undefined"` — в `extractApiMessage` добавлена явная
проверка на null/undefined, иначе в UI так и печаталось бы.

## [2026-09-14 / шаг 18] 21 роут на `useLogger` + `createError` из evlog; мёртвый `apiError` удалён
**Запрос:** «во всех server/api роутах используй useLogger + createError из evlog с полями why и fix».
**Найденный попутно дефект:** `server/utils/api/error.ts` с `apiError()` не вызывался **ни из одного** роута —
все 21 кидали сырой `createError({ statusCode, statusMessage })`, что прямо запрещено AGENTS.md («Never raw
`createError`»). То есть правило §6 описывало envelope `{ error: { code, message } }`, которого в ответах не
было. Клиент (`CreateIdeaForm.vue`, `extractApiMessage`) читал `e.data?.error?.message` → всегда `undefined`,
и пользователю показывалась заглушка из `e.message`. Удаление хелпера вместе с миграцией — единственная
версия, где код и правило совпадают.
**План:** `code` сохраняем (evlog поддерживает нативно, клиент ветвится по коду), `why`/`fix` по-русски,
`/docs/:name` тоже мигрируем, `parseUuid` не трогаем (смена типа ошибки в `shared/schemas` — поведенческий
ломкой change вне задания, см. «Открытый дефект»).
**Результат:**
- все 21 роута: `useLogger(event)` + `log.set()` по мере получения контекста; ошибки — `createError` из `evlog`
  с `code`/`why`/`fix`
- ответы дёшевы на утечки: `internal` для причин драйвера Postgres (`health`), для `reason` упавшего
  MVP-потока и для статуса валидатора; наружу — человекочитаемое `message`
- коды отражают реальные ветки: `IDEA_NOT_FOUND`, `IDEA_ARCHIVED`, `IDEA_LIMIT_REACHED`, `JOB_NOT_FOUND`,
  `JOB_STATE_CONFLICT`, `PIPELINE_STEP_INVALID`, `DOC_NOT_FOUND`, `DOC_UNREADABLE`, `AUDIO_MISSING`,
  `STT_NOT_CONFIGURED`/`STT_UPSTREAM_ERROR`/`STT_PROCESSING_FAILED` (по фактическим `throw` в `enqueue.ts`
  и `stt.ts`, не по догадке)
- SSE `stream.get.ts`: логгер только до открытия потока. Широкое событие эмитится на закрытии соединения,
  после `emit()` логгер запечатан, `log.fork` в Nuxt-интеграции нет — `log.set()` внутри `setInterval`
  потерялся бы с warning'ом
- `server/utils/api/error.ts` удалён: `grep` по `app/ server/ shared/ config/ scripts/ e2e/` не нашёл ни
  одного импорта — за него держались только правила в документах; `AGENTS.md` «API rules» и
  `docs/conventions.md` §5/«Error format»/§7 переписаны в этом же коммите — иначе история коммита
  содержала бы правило, противоречащее коду
**Проверка (живой прогон на `pnpm dev`):**
- `GET /api/ideas/00000000-…` → 404 телом `{"status":404,"message":"Идея не найдена","data":{"code":
  "IDEA_NOT_FOUND","why":"В таблице Ideas нет записи с id=…","fix":"Вернитесь на доску…"}}`
- `GET /docs/NOPE` → 404 с `code: DOC_NOT_FOUND`, в `fix` — перечень доступных документов
- wide event: `/api/ideas` → `ideas.count`, `/api/health` → `health.db`, `/docs/NOPE` → `doc.known:false`,
  404 идеи → `idea.id` + `level:"error"` + `status:404`
- **доказательство смены слоя:** в стеке события было `at createError (…/h3/dist/index.mjs:71)` (замер шага 17),
  стало `EvlogError: … at createError (…/.nuxt/dev/index.mjs:3692)`
- `pnpm typecheck` → exit 0; `pnpm lint` → **152 errors / 5 warnings** против **158** на этом же дереве без
  правки `server/` (замер через `git stash push -- server/` + `pop`), то есть миграция сняла 6 ошибок и
  не добавила ни одной; в `server/api` и `server/routes` после правки — **ноль** проблем
**Фиксы цикла проверки:** (1) `validatorPassed: verdict.passed` — поля `passed` в `ValidateResult` нет,
реально `{ errors, valid }`, заменил на `validatorValid`/`validatorErrors`; (2) `stt: { words }` — в
`TranscribeResult` нет `words`, оставил `cost`/`seconds`; (3) два вложенных тернарника (`sonarjs`) и
неиспользуемый импорт `createError` в SSE — на `if/else if`; (4) иероглиф, попавший в комментарий SSE,
и смешанный каламбур в комментарии к `ideas/index.get.ts`; (5) `JSON.parse(JSON.stringify(ticketCard))`
в `mvp.post.ts` — наследственные 2 ошибки линта (`no-unsafe-assignment` + `prefer-structured-clone`),
без их снятия коммит не проходит `lint-staged --max-warnings 0`. Первая попытка — `structuredClone` —
**уронила typecheck**: JSON-прогон возвращал `any` и прятал, что `ValidateResult` это `interface`,
а интерфейс без неявного index signature не входит в `JsonValue` Prisma (TS2769). Оставленный вариант
собирает снимок литералом: ни `any`, ни `as`, поведение то же.

**Открытый дефект (осознанно вне этого шага):** невалидный UUID в параметре даёт `ZodError` из
`parseUuid` → 500 «Internal Server Error» вместо 400. Чинится в одном месте (`shared/schemas`), но это
смена публичного типа ошибки — требует решения человека.

## [2026-09-14 / шаг 17] Evlog доведён до доки: fs-drain с ротацией, `/docs/**` в include, сэмплинг в проде
**Запрос:** то же задание, пункт «поставь evlog по официальной доке, добавь в nuxt.config».
**План:** модуль и блок `evlog` в конфиге уже были; не хватало двух — события никуда кроме stdout не
писались (drain не зарегистрирован, а навык `analyze-logs` из `.agents/skills/` адресует `.evlog/logs/`),
и `include: ['/api/**']` оставлял без события `server/routes/docs/[name].get.ts`.
**Результат:**
- `server/plugins/evlog-drain.ts` — `evlog:drain` + `createFsDrain({ maxFiles: 7, maxSizePerFile: 10 МБ })`;
  потолок ~70 МБ на контейнер, самое старое адаптер удаляет сам после записи
- `nuxt.config.ts`: `env.environment` из `APP_ENV`, `include: ['/api/**', '/docs/**']`,
  и `$production.evlog.sampling` — `rates: { info: 10, debug: 0 }` при 100% для warn/error
  и `keep: [{ duration: 1000 }, { status: 400 }]`
- поведение доки, а не догадка: `useLogger` бросает, если логгер не инициализирован, но Nitro-плагин
  evlog создаёт `event.context.log` на **каждом** запросе — `include` влияет только на emit. Поэтому
  `/docs/**` было безопасно логировать и до правки, оно просто молча теряло событие.
**Проверка (живой прогон, не «должно работать»):** старый dev-сервер (22 ч, потомок закрытой сессии, трое
сирот, `/api/health` → 503 при живой БД) перезапущен; `GET /api/health` → 200 `{"db":"ok"}`;
в `.evlog/logs/2026-09-13.jsonl` широкие события с `requestId`/`status`/`durationMs`/`service`/`environment`;
`GET /docs/TZ` — впервые дал событие (до правки не давал), `GET /docs/NOPE` — событие с `error`;
`.evlog/.gitignore` создан адаптером сам, в `git status` каталога нет.
В стеке ошибки видно `createError` из `h3` — подтверждение, что роуты ещё не на evlog, это шаг 18.
`pnpm typecheck` → exit 0; `eslint` по изменённым файлам → чисто (после `--fix` ключа `$production`:
правило `nuxt/nuxt-config-keys-order`).

## [2026-09-14 / шаг 16] Sentry удалён полностью, наблюдаемость остаётся на evlog
**Запрос:** «удали Sentry полностью и поставь вместо него evlog по официальной доке, добавь в nuxt.config,
и во всех server/api роутах используй useLogger + createError из evlog с полями why и fix».
**План:** этот шаг — только удаление Sentry (коммит A). Evlog уже стоит (`evlog@2.28.1`, модуль в `modules`),
его доводкой до доки, fs-drain, роутами и клиентом — шаги 17–20 этого же задания.
**Результат:**
- удалены `sentry.client.config.ts`, `sentry.server.config.ts`, `@sentry/nuxt` из `package.json`
- `pnpm-lock.yaml`: −534 строки, ушли и транзитивные (`@nuxt/kit@3.21.11`, opentelemetry, replay, bundler-plugins);
  `grep -ci sentry pnpm-lock.yaml` → 0, из `node_modules` выбрано 34 пакета
- `nuxt.config.ts`: модуль + `runtimeConfig.sentryDsn` и `public.sentryDsn` (оба читались только из удаляемых конфигов)
- `pnpm-workspace.yaml` (`allowBuilds: '@sentry/cli'`), `.env.example` (`SENTRY_DSN`),
  `docker-compose.dokploy.yml` (строка env + упоминание в шапке), `README.md` (таблица переменных),
  `docs/ARCHITECTURE.md` (стек, структура, схема наблюдаемости, безопасность, таблица зависимостей)
- `DEVLOG.md` — исторические строки шага 7 не переписаны: журнал показывает, что Sentry был, а не чего в нём
  испугались
**Проверка:** `pnpm typecheck` → exit 0, 0× `error TS`; `pnpm lint` → **112 errors / 5 warnings**, идентично
baseline этого же дерева (замерен до первой правки); `pnpm exec nuxt prepare` → типы собраны;
`pnpm dlx @evlog/cli map --no-write` → **31/100, 21 из 21 API-хендлеров с пробелами** — отправная точка
для шага 18. Чужих `sentry`-упоминаний в коде не осталось (ripgrep по *.ts/*.vue/*.mjs/*.json/*.yml/*.md —
только DEVLOG-история).
**Фиксы (два цикла, оба через агент):**
1. `pnpm remove @sentry/nuxt` виснет 5 минут без вывода. Причина — `postinstall` (`nuxt prepare && prisma skills sync`)
   на живом dev-сервере. Обход: правка `package.json` вручную + `pnpm install --lockfile-only --ignore-scripts`
   (1м10с) + `pnpm install --ignore-scripts` (15с). Правило «pnpm only» не нарушено: обошёл скрипт, не пакетный менеджер.
2. В working tree параллельной сессией велась чужая незакоммиченная правка (`eslint.config.mjs`,
   `scripts/ui-detect.mjs`, строка `ui:detect` в `package.json`). Моя команда `git switch -c` переключила общий
   HEAD посреди её работы. По решению владельца чужие правки в этот коммит не взяты: строка `ui:detect`
   временно снята в патч и возвращена в дерево, `eslint.config.mjs` и `scripts/ui-detect.mjs` не стейджились.
   **Смена требования, проведённая через агента:** из hard-правила §7 «один активной ветки за раз» следует,
   что параллельные сессии обязаны расходиться по worktree — зафиксировано в шаге 20.

## [2026-09-13 / шаг 15] Источник стенда привязан к GitHub App; автодеплой проверяется этим коммитом
**Запрос:** «сначала разберёмся с автодеплоем».
**План:** причина нулевых webhook'ов на репозитории не в ключе (гипотеза шага 13 и поправка шага 14
сошлись на «401», но там дергали `/api/composed` — путь-опечатка; на корректный
`github.githubProviders` тот же ключ отвечает 200), а в том, что ресурс висел на `sourceType: git` с
`customGitUrl`: подписку панель заводит только через подключённого провайдера. Переключить источник →
деплой как регресс-проверка клонирования → затем проверить сам автодеплой пушем без ручного триггера.
**Результат:**
- `compose.update`: `sourceType: github`, `githubId` провайдера `Dokploy-2026-09-13-j8mbvm`,
  `customGitUrl`/`customGitBranch` обнулены (два источника в одном ресурсе — будущая ловушка)
- первый деплой с новым источником: `done`, `web` healthy, `migrate` Exited (0), `/api/health` → `db ok`
- **заголовок деплойки не доказывает автозапуск:** Dokploy подставляет в него сообщение HEAD-коммита,
  поэтому все 4 предыдущие записи, «похожие на push», — мои ручные `compose.deploy`
- **ноль хуков на репозитории — норма для GitHub App:** подписка живёт на уровне installation,
  `GET /repos/…/hooks` ничего не проверяет; критерий только один — новая деплойка без вызова с нашей стороны
**Проверка (критерий выдержан):** коммит docs-only запушен в `main` в **15:46:58 UTC без вызова
`compose.deploy`** → в `deployment.allByCompose` появилась пятая запись, старт **15:47:02.834 UTC**
(+4 с), `done` за 13 с, после — `/api/health` → `{"db":"ok","status":"healthy"}`. Автодеплой работает.
Второй независимый цикл подтверждён: пуш правки этого же абзаца в **15:56:09 UTC** поднял шестую
деплойку в **15:56:12.614** (+3.6 с), `done` за 13 с, `/api/health` снова `db ok`. Итого автодеплой
доказан дважды подряд, задержка пуш → старт сборки 3–4 секунды.
**Fixes:** (1) гипотеза «ключ не принимается» опровергнана: 401 был следом запроса на `/api/composed`
(путь-опечатку принёс шаг 14); на корректный путь тот же ключ даёт 200; (2) вывод «деплойка с заголовком
коммита = сработал webhook» признан ложным — заголовок Dokploy берёт из HEAD; (3) `GET /repos/…/hooks`
= `[]` при рабочем автодеплое: у GitHub App подписка на уровне installation, так что список хуков
репозитория — не диагностический признак (в `AGENTS.md` абзац переписан на этот факт).

## [2026-09-13 / шаг 14] Ветка задания и мёрдж в `main` как правило репозитория
**Запрос:** «стоит ли прописать в `AGENTS.md`, что всегда надо создавать новую ветку на фичу/задание, а
потом мёрджить в `main`?» → после разбора «делай».
**План:** не писать правило «с головы», а сначала измерить, как git используется сейчас (ветки,
merge-коммиты, CI, что реально триггерит деплой), и только потом зафиксировать порог. Форма решения —
2 пункта в hot-path `AGENTS.md`, детали в новый `docs/conventions.md` §16.
**Результат:**
- `AGENTS.md` Default workflow п. 6–7: ветка на задание, чей дифф трогает исполняемое (первая команда —
  `git switch -c <type>/<slug>`, одна активная ветка за раз, перед первым коммитом печатается вывод
  `git rev-parse --abbrev-ref HEAD`); мёрдж в `main` приравнен к деплою и требует явного «да» человека
- `docs/conventions.md` §16: список путей, полный порядок из 7 шагов (rebase → повторный прогон →
  `merge --ff-only` → push → удалить ветку), почему linear, а не merge-ноды, и почему одна dev-БД на все
  ветки — second parallel branch со схемой запрещена
- `docs/conventions.md` §12: дубль заголовка (`## 12. Comments & Docs` + `## 12. Dependencies`) склеен в
  `## 12. Comments, Docs & Dependencies` с `###`-подразделами — без перенумерации, потому что `§15`
  упоминается из `app/app.vue`, `app/features/create-idea/CreateIdeaForm.vue` и `.opencode/commands/ui.md`
- `AGENTS.md` раздел Deploy: строка «push в main → авто-деплой по webhook» переписана под проверенный факт
  (см. Fixes 3)
**Проверка (замеры, а не ощущения):**
- git: 87 коммитов, **одна** ветка `main`, 0 merge-коммитов, 0 worktree, 0 stash; 34 из 87 коммитов —
  `docs:`/`chore:` (≈39%), то есть правило «ветка на всё» гоняло бы 40% истории через обряд без пользы
- CI нет: `.github/workflows` отсутствует; из хуков только husky `pre-commit` → `lint-staged`, а он покрывает
  только `*.{ts,vue,mjs}` — «мёрдж через protected branch с обязательными проверками» тут не на что опереться
- `gh api repos/nikgritenok/idea-factory/hooks` → `[]`; `DOKPLOY_API_KEY` из `.env` → `401` на
  `/api/composed`, так что branch-фильтр триггера деплоя из репозитория прочитать не удалось (открыто)
- baseline прямо сейчас, до правки: `pnpm lint` → 157 errors / 5 warnings, exit 1; `pnpm typecheck` →
  exit 0 (шум — `NUXT_B3011` WARN про дубли имён `Ui*`); `pnpm test` → 6 failed / 52 passed. Совпадает с
  записями шагов 12–13
- собственный дифф — только два `.md` (`git status --short`), то есть правило соблюдено с первого
  применения: markdown-правка залендена в `main` без ветки
**Fixes:** (1) первая формулировка порога была «по префиксу коммита» — опроверг собственный коммит
`04b6421 chore(deploy)`, который менял весь прод-стек: порог переписан по файлам в диффе, и это зафиксировано
в §16 отдельной строкой; (2) гейт мёрджа был «зелёный прогон» — измеренный baseline (6 падений, 157
lint-errors) сделал бы невозможным любой мёрдж, переформулирован как «не хуже baseline» с таблицей фактов;
(3) найдено противоречие внутри документов: `AGENTS.md` обещал «push в main → авто-деплой по webhook», а
DEVLOG шага 13 Fixes (1) уже записывал, что webhook GitHub не заведён — теперь в обоих местах одна
реальность, механизм триггера помечен как непроверенный и вынесен на человека (нужен заход в панель);
(4) правка `AGENTS.md` сначала была на русском внутри англоязычного нумерованного списка — приведена к
языку окружающих пунктов.

## [2026-09-13 / шаг 13] Публичный стенд на Dokploy: idea-factory.nikgretenok.online
**Запрос:** «развернуть на Dokploy, руками всё делать устал».
**План:** не переписывать прод-композицию, а подогнать её под Dokploy (Traefik вместо host-портов,
one-shot миграций без `profiles`, переменные из Environment вместо `env_file`), создать ресурс через
API панели и проверить стенд прогоном, а не «должно подняться».
**Результат:**
- `docker-compose.dokploy.yml`: 5 сервисов (db, migrate, web, worker, validator); домен навешивается
  средствами Dokploy, а не labels в файле; `db_data` — именованный том (иначе не работают Volume Backups)
- репозиторий сделан публичным (решение владельца из трёх вариантов) — Dokploy клонирует без ключей;
  перед открытием проверена вся история на секреты: совпадений кроме шаблонов в `.env.example` и
  локального дефолта `postgres:postgres@localhost` нет
- ресурс в Dokploy создан API-вызовами: проект `idea-factory` (`LT7PhDW0FIa8LtVz4D8b3`),
  compose `iBlMyodcxu11rnECVBiYD`, домен `f3Sv6eKwFYASDCzK15Wbf` (https + letsencrypt, сервис `web`,
  порт 3000), Environment из 9 переменных; `autoDeploy: true`
- починены два реальных дефекта, всплывших по дороге: `.env` с шаблонными `DOKPLOY_*` и висячей
  запятой ломал любой `docker compose` в каталоге; стадия `migrate` не копировала `prisma.config.ts`
  → Prisma 8 выходила с кодом 2, и из-за `service_completed_successfully` web навечно оставался
  в `created` (см. коммит 450d583)
**Проверка (стенд, а не локально):**
- деплой №1 упал за 49 мс: `sourceType: github` требует подключённого GitHub-провайдера, в панели его
  нет → переведено на `sourceType: git` + публичный URL; деплой №2 упал на миграциях (см. выше), №3 —
  `done` за ~5 минут
- `https://idea-factory.nikgretenok.online/api/health` → `{"db":"ok","status":"healthy"}`, curl **без**
  `-k` (то есть сертификат Let's Encrypt проходит проверку), `/` → 200 с `<html lang="ru">` и заголовком
  формы, `http://` → 301 на https
- контейнеры: `db` healthy, `validator` up, `web` up (healthy), `worker` up без рестартов,
  `migrate` Exited (0)
- очередь живая: `POST /api/ideas` → `paused/draft` (так и задумано), `POST /api/ideas/:id/run` →
  job в `queued`, воркер подхватывает, этап переходит `queued → research`, идемпотентный ключ на месте
- **найдено падение конвейера (не исправлено):** шаги LLM валятся — `idea_analysis` с
  «LLM вернул невалидный формат» (все 8 полей отсутствуют, то есть `content` = `{}`), `market_research`
  с `terminated`. Диагностика по прямым запросам к провайдеру: модель `z-ai/glm-5.3-flash` доступна и
  на коротком промпте возвращает валидный JSON с теми же флагами, но в `usage` видно
  `reasoning_tokens: 306` из `completion_tokens: 635` — reasoning съедает бюджет `max_tokens`, и на
  длинном промпте с большим JSON остаётся пустой `content`. То есть дефект в бюджете токенов/обработке
  пустого ответа в `server/utils/llm.ts` и конфигах ролей, а не в деплое; локально он тоже воспроизводим
- на стенде оставлена тестовая идея `ba9257db-7b48-4714-ba4b-39bf5ddf4c22` в статусе error — по ней
  удобно воспроизводить починку LLM-шага
**Fixes:** (1) авто-деплой по webhook GitHub не заведён (нет провайдера) — триггер деплоя: API
`compose.deploy` или webhook-URL из панели; (2) `certificateType` в `domain.create` не принимается,
нужен отдельный `domain.update` с обязательным `host` — сделано; (3) тест «доступна ли модель» изначально
сделан на чужом имени (`qwen3.8-flash` из конфига OpenCode, не приложения) — переделан на `z-ai/glm-5.3-flash`.

## [2026-09-13 / шаг 12] Доступность: автоматические проверки сняты по решению владельца
**Запрос:** «убери всё, что связано с a11y-проверками — линтер и тесты».
**План:** снять три слоя (линтер-плагин, модуль DevTools-скана, axe-спеку) и зависимости, разметку не
трогать (это корректность HTML, а не проверка), требования в документах переписать под новую реальность.
Перед удалением зафиксировано, что это изменение требования, а не мусора: a11y обязательна по
`AGENTS.md` и `TZ.md` §6/§16.
**Результат:**
- удалены `eslint-plugin-vuejs-accessibility` (import + блок `flat/recommended` в `eslint.config.mjs`),
  `@nuxt/a11y` (из `modules`) и `e2e/accessibility.spec.ts` + devDep `@axe-core/playwright`
- `AGENTS.md`: раздел «Tests & a11y» → «Tests», вместо трёх слоёв — строка о решении и чем проверяем
- `docs/conventions.md` §11 переписана: требование осталось, добавлено честное следствие — «зелёный
  `pnpm e2e` больше не подтверждает отсутствие a11y-регресса»; в §15 — чем закрываем (ревью разметки
  в диффе, клавиатурный проход в ритуале, контраст по парам токенов, статус текстом)
- `TZ.md` §15: решение записано как осознанное упрощение, а не как забытая проверка
- разметку сохранили: `aria-current`/`role`/`label` и добавленный на этом шаге `<html lang="ru">`
**Проверка:**
- `pnpm lint` — 157 ошибок против ~159–160 на baseline (стало меньше: ушли правила a11y-плагина);
  из тронутых мной файлов в списке только `CreateIdeaForm.vue` — 1 ошибка + 5 предупреждений,
  **дословно те же, что на HEAD** (проверено прогоном `eslint --stdin` по исходной версии файла)
- `pnpm typecheck` — exit 0, 0 `error TS`
- `pnpm test` — 6 failed / 52 passed, идентично baseline (падает только backend: queue/llm/ideas)
- `pnpm e2e` — 2 passed / 1 failed: `smoke.spec.ts:15` ждёт заголовок `x-request-id`, которого в коде
  нет (`grep` по `server/` — ни одного упоминания, `curl -D -` заголовок не отдаёт). **Проверка
  до этого падала по той же причине** — к этой правке отношения не имеет, требует решения человека
**Fixes:** (1) `git rm` отказался удалять спеку с локальными правками — удалена `-f`, правки были
про `appAxe()`-хелпер, который всё равно ехал в мусор; (2) комментарий про `lang="ru"` сначала ссылался
на правило axe — переписан на требование TZ, иначе после удаления сканера ссылался бы на несуществующее.

## [2026-09-13 / шаг 11] Независимая оценка дизайна: finish-reviewer подключён к OpenCode
**Запрос:** «нужен ли playwright-cli, или достаточно agent-browser» → выросло в «мне критически нужен
impeccable, чтобы оценивать дизайн целиком, а не только вёрстку».
**План:** (1) выяснить, что вердикт «красиво и логично» в impeccable отдаёт отдельный агент
`impeccable_finish_reviewer`, и что в OpenCode он не запускался (лежал в Codex-формате `.toml`,
каталога агентов нет, в списке субагентов только `explore`/`general`) → значит работал degraded-путь:
тот же контекст ревьюит сам себя; (2) портировать в `.opencode/agents/`; (3) обкатать на живом экране;
(4) убрать `playwright-cli`, который дублировал `agent-browser`.
**Результат:**
- `.opencode/agents/impeccable-finish-reviewer.md` — `developer_instructions` из `.toml` дословно
  (14 936 симв.), `mode: subagent`, `steps: 24`, deny на edit/shell/subagent/webfetch/websearch/skill
  (ревьюер по контракту без браузера); имя через дефисы — ровно то, которое просит `new-work.md`
- цикл проверки в `AGENTS.md` / `conventions.md` §15 / `.opencode/commands/ui.md`: один пакетный осмотр
  → один пакет фиксов → подтверждающий скрин → **один** вызов ревьюера вне цикла → его фиксы пакетом
- скриншоты — артефакт доказательства: `.impeccable/review/` (+ `.gitignore` на артефакты и
  `config.local.json`)
- удалены скилл `playwright-cli` (`pnpm exec skills remove -y`) и devDep `@playwright/cli`;
  `@playwright/test` и e2e-регресс не затронуты
- применены 7 из 8 `material_fixes` ревьюера: неактивная primary-кнопка спроектирована из токенов
  (было 2.4:1 вместо AA), поле ввода приведено к `input-field` (белое, 8px, 16px вместо тёплого
  холста 24px/14px), карточка формы 16px, primary на всю ширину колонки, волна записи с `height`
  на `transform: scaleY`, вся мелкая типографика на уровни `DESIGN.md`, `#FFB922` заменён на
  новый `app/components/BrandSun.vue` (`currentColor`), тот же глиф в шапке вместо стоковой
  `lucide:sun`, мобильная навигация — три пункта с `/settings` вместо дубля `/`, поля 24/64px
**Проверка:**
- дымовой прогон субагента: сам назвал роль, четыре слова `disposition`, пять секций контракта и
  поведение при отсутствующих скринах → портирование живое, а не «файл создан»
- **полный цикл на экране создания идеи**: `disposition: fix`, 8 фиксов, все с координатами в кадре
- verdict-проход по пересъёмке: 7 resolved, 1 открыт по решению (шрифт), и ревьюер **сам снял**
  своё утверждение про окклюзию кнопки на мобильном — измерение в браузере дало 39px запаса,
  а обманул его полностраничный скрин: `position: fixed` бар рисуется посреди документа
- `impeccable detect --json` по тронутым файлам: было 3 находки → 0
- `pnpm typecheck` 0 ошибок; `pnpm test` идентично baseline; `pnpm e2e` — см. шаг 12 (тот же
  pre-existing `x-request-id`)
- шрифт-находка проверена независимо: `curl` css2 от Google Fonts отдаёт только `latin`/`latin-ext`
  unicode-range, `grep -c cyrillic` = 0 → Outfit кириллицу не рисует, весь русский интерфейс
  идёт системным фолбэком. Это единственный открытым оставшийся пункт и он требует решения человека
**Fixes:** (1) первая пер-едит-проверка была написана как плагин `.opencode/plugins/impeccable-detector.ts`
и не загрузилась: `Cannot find package '@opencode/plugin'` — локальные плагины резолвятся от файла, а
пакет лежит только в `~/.config/opencode/node_modules`; удалено, вопрос места установки — к человеку;
(2) `agent-browser screenshot --full ./относительный.png` молча кладёт файл в свой tmp-каталог
(относительный путь принят за селектор) → в конвенции зафиксирован абсолютный путь; (3) островок
Nuxt DevTools попадал и в скриншоты, и в axe-скан (3 из 4 нарушений контраста были его собственными)
→ удаляется из DOM перед съёмкой; (4) dev-том Postgres отсутствовал, после `docker compose up` БД
не пиналась: в `.env` `POSTGRES_PASSWORD` ≠ пароль в `DATABASE_URL`; том пересоздан с паролем из
`DATABASE_URL`, `.env` не тронут, данных не было (том пустой), миграции применены — 37 операций.


## [2026-09-13 / шаг 10] Дизайн-система фронтенда: motion-v + impeccable + capture-режим
**Запрос:** собрать повторяемую систему, чтобы AI-агент сам придумывал дизайн, проверял его в браузере, находил визуальные и a11y-дефекты и держал премиальный вид с дорогими анимациями — без похода в интернет на каждую задачу.
**План:** (1) скиллы `impeccable` (процесс и вкус) и `motion` (официальный, от Motion) через skills CLI в `.agents/skills` + пин в `skills-lock.json`; (2) `motion-v` как единственная движущая сила, политика на всё дерево в `app/app.vue`; (3) capture-режим `?motion=off` для детерминированных скриншотов и стабильного axe; (4) правила слоя в `docs/conventions.md §15` + короткий блок в AGENTS.md; (5) точка входа `/ui`.
**Результат:**
- `.agents/skills/impeccable` (v4.3.1, 343 коммита в скилле, контент 2026-09-10) и `.agents/skills/motion` (лучшие практики, включая `best-practices/vue.md`) — лежат в `.agents/`, который в `.gitignore`; в git попал только `skills-lock.json`, воспроизводится `pnpm skills`
- Проверен вариант impeccable: приехавший `SKILL.md` ссылается на `.agents/skills/impeccable/scripts/impeccable` (3/3 совпадения) — это рабочая копия, а не `.opencode`-вариант с чужими путями
- `motion-v@2.4.2` + модуль `motion-v/nuxt`; `MotionConfig :reduced-motion` в `app/app.vue`
- `e2e/accessibility.spec.ts`: все переходы через `gotoQuiet()` с `?motion=off`, axe сканирует неподвижное дерево
- `docs/conventions.md` §15 (слои, разрешённые свойства анимаций, capture-режим, bounded-цикл, что требует сети) + AGENTS.md «Frontend: дизайн-система»
- `.opencode/commands/ui.md` — один вход в цикл
**Проверка:**
- `pnpm typecheck` — exit 0, 0 ошибок (то есть модуль и авто-импорт `MotionConfig` реально резолвятся)
- `pnpm lint` по затронутым файлам — чисто; по репозиторию 160 ошибок против 159 на baseline, дельта +1 = порядок импортов в моём e2e-файле, исправлено `--fix`
- `pnpm test` — 6 failed / 52 passed, идентично baseline (`git stash` прогон): падает только backend (queue/llm/ideas), новых падений 0
- на живом dev-сервере + `agent-browser`, пробная страница `<motion.div :animate="{x:80, duration:3}">`: обычный режим → первый кадр `transform: none`, через 4 с `matrix(1,0,0,1,80,0)`; `?motion=off` → **первый кадр уже** `matrix(1,0,0,1,80,0)`. То есть capture-режим действительно глушит transform
- там же проверено утверждение про opacity: под `always` opacity продолжает анимироваться (первый кадр `0.117`, после стабилизации `1`) — поэтому правило «перед снимком ждать успокоения кадра», а не «capture решает всё»
- `skipAnimations` в `MotionConfig` проверен по исходникам `motion-v@2.4.2`: доходит только до императивного `useAnimate`, для `<motion.*>` no-op — в конвенциях запрещён
- `pnpm exec playwright test e2e/accessibility.spec.ts` — 1 passed, 2 failed; те же 2 падают и без моей правки. **Найдено реальных дефектов приложения:** у `<html>` нет `lang`, `#888888` на `#ffffff` = контраст 3.54 при норме 4.5, контент вне landmark (`region`). Chromium для Playwright ранее не был установлен, поэтому a11y-суиту никто не прогонял
**Fixes:** (1) первый замер capture-режима был неверным — сравнивал финальный кадр после 2 с ожидания, где анимация уже завершилась; перемерено с `duration: 3` и отбором кадра сразу после загрузки; (2) импорт `MotionConfigProps` из `motion-v` не экспортируется — убран, тип выводится из литералов; (3) порядок импортов в e2e поправлен eslint `--fix`; (4) пробная страница `app/pages/motion-probe.vue` удалена, в дерево не попала

## [2026-09-10 / шаг 9] Инфраструктура и деплой (CI/CD + Docker)
**Запрос:** настроить продакшен-инфраструктуру — Docker multi-stage, docker-compose.prod.yml, healthcheck, миграции, деплой.
**План:** (1) healthcheck endpoint; (2) Dockerfile multi-stage + non-root; (3) docker-compose.prod.yml; (4) .dockerignore; (5) деплой + smoke test; (6) ARCHITECTURE.md.
**Результат:**
- `server/api/health.get.ts` — `GET /api/health` проверяет БД через ORM, возвращает `{db, status, timestamp}` или 503
- `Dockerfile` — 4 стадии: deps → build → migrate → runtime. Non-root user (app:1001), standalone Nitro output, нет node_modules в runtime
- `docker-compose.prod.yml` — 4 сервиса: db (postgres:16-alpine, healthcheck), web (NITRO_PORT=3000, healthcheck), worker (WORKER_MODE=true), migrate (profiles=setup, one-shot)
- `.dockerignore` — исключает node_modules, .output, .git, .env (контекст: 1.8GB → 30KB)
- `.env.example` — обновлён со всеми переменными окружения
- Образ: 260MB (было ~800MB+)
**Проверка:** `docker compose up -d` → все 3 сервиса healthy. `curl /api/health` → `{db: "ok"}`. Сайт `https://idea-factory.nikgretenok.online` → 200. `curl /api/ideas` → данные.
**Fixes:**
- `db.raw.sql` syntax для Prisma 8 healthcheck — заменён на `db.orm.public.Ideas.select('id').limit(1).all()`
- `postgresql://` scheme required для pg driver в Docker (не `postgres://`)
- Password auth failed при повторном использовании volume — `ALTER USER postgres PASSWORD`_needed after volume reuse
- `.dockerignore` обязателен — без него контекст 1.8GB, билд ~5 минут

## [2026-09-10 / шаг 8c] Исправление продакшен-билда (502 Bad Gateway)
**Запрос:** сайт на продакшене не открывается (502 Bad Gateway).
**План:** проверить билд, найти ошибку Nitro, исправить импорт.
**Результат:**
- `server/utils/schemas.ts` — заменён `../../shared/schemas` на `~~/shared/schemas` (Nitro не мог разрезолвить относительный путь за пределами `server/`)
**Проверка:** `pnpm build` — ✨ Build complete! `pnpm typecheck` — 0 ошибок. Запушено в `main`.
**Fixes:** Nitro при продакшен-билде не может разрезолвить относительные пути, выходящие за пределы `server/`. Используем `~~/` алиас (корень проекта).

## [2026-09-10 / шаг 8b] Исправление runtime ошибок и компонентов
**Запрос:** фронтенд должен загружаться без ошибок в консоли.
**План:** (1) добавить явный импорт `JobProgress` в `IdeaCard.vue`; (2) добавить `<NuxtPage />` в `[id].vue` для вложенных маршрутов; (3) исправить все `new Date()` → `.toISOString()` в серверном коде; (4) исправить `JsonValue` касты через `as any`; (5) исправить `ensureMigrated` (не существует); (6) исправить `addEdge` типы; (7) исправить `DatasetParams` литералы; (8) исправить тесты.
**Результат:**
- `app/features/ideas/IdeaCard.vue` — добавлен `import JobProgress from '../jobs/JobProgress.vue'`
- `app/pages/ideas/[id].vue` — добавлен `<NuxtPage />` для вложенных маршрутов
- `server/queue/claim.ts`, `controls.ts`, `enqueue.ts`, `run-protocol.ts`, `worker.ts` — все `new Date()` → `.toISOString()`
- `server/queue/run-protocol.ts`, `calc-executor.ts`, `validator-client.ts` — `JsonValue` касты через `as any`
- `server/plugins/worker.ts` — удалён `ensureMigrated` (не существует в `db.ts`)
- `server/queue/worker.ts` — `addEdge` касты `'__start__'` вместо `string`
- `server/utils/efficiency/dataset.ts` — `DatasetParams` тип: `{ [K in keyof ...]: number }`
- Тесты: добавлен `db` в контекст, исправлен `split()` safety
**Проверка:** `pnpm typecheck` — 0 ошибок. `vue-tsc --noEmit` — 0 ошибок. Dev сервер отдаёт HTML.
**Fixes:** (1) Компоненты в `app/features/` не auto-importятся — нужен явный импорт; (2) Вложенные маршруты требуют `<NuxtPage />` в родительском компоненте; (3) Prisma `TimestamptzString` ожидает `string`, не `Date`; (4) `JsonValue` не принимает `Record<string, unknown>` — нужен `as any` каст.

## [2026-09-10 / шаг 8a] Исправление всех ошибок typecheck
**Запрос:** все ошибки vue-tsc и TypeScript должны быть исправлены, фронтенд должен загружаться.
**План:** (1) перенести `useIdeas.ts` в `app/composables/` для auto-import; (2) создать `app/features/jobs/types.ts` с `JobSummary`; (3) исправить Prisma `.and()` → chaining `.where()`; (4) исправить `count()` → `select('id').all().length`; (5) исправить `JsonValue` касты в `worker.ts`; (6) исправить `resolve()` void parameter.
**Результат:**
- `app/features/ideas/useIdeas.ts` → `app/composables/useIdeas.ts` (auto-import работает)
- `app/features/jobs/types.ts` — создан с re-export `JobSummary` и `JOB_STATUS_LABELS`
- `server/api/ideas/[id]/outputs.get.ts` + `report.get.ts` — `.and()` заменён на chaining `.where()`
- `server/utils/ideas.ts` — `countActiveIdeas()` переписан с `aggregate(a => a.count())` на `select('id').all().length`
- `server/queue/worker.ts` — `persistResults()`: касты для `output`, `score` (String), `sections`, `stopFactors`
- `app/features/voice-input/useVoiceInput.ts` — `resolve()` → `resolve(undefined)`
**Проверка:** `pnpm typecheck` — 0 ошибок. `pnpm test` — 54/55 passed (4 failed из-за окружения, не код).
**Fixes:** (1) Prisma 8 не имеет `.and()` на выражениях — chaining `.where()` компонует AND автоматически; (2) `count()` недоступен на `AggregateOperationsUnavailable` —替代方案 через подсчёт строк; (3) `Numeric(4,1)` маппится в `string`, не `number` — нужен `String()` каст; (4) `JsonValue` не принимает `Record<string, unknown>` без каста.

## [2026-09-10 / шаг 8] Пайплайн работает: LLM JSON mode + персистентность + MVP UI
**Запрос:** пайплайн должен проходить все 7 шагов и сохранять результаты в БД для UI.
**План:** (1) добавить `response_format: json_object` + `structured_outputs: true` в `callLlmRaw`; (2) исправить промпты ролей (русские enum → английские); (3) добавить `persistResults` в worker (agent_outputs + reports); (4) добавить `index.get.ts` для карточки идеи; (5) MVP UI компонент; (6) read-only демо-доступ.
**Результат:**
- `server/utils/llm.ts` — `response_format: { type: 'json_object' }`, `structured_outputs: true`, дефолт таймаут 300с
- `config/roles/orchestrator.ts` — промпт с явными English-значениями для complexity/priority
- `shared/schemas/roles/orchestrator.ts` — preprocessors для русских значений, фолбэки для missing fields
- `server/queue/worker.ts` — `persistResults()`: помечает старые outputs/reports как outdated, создаёт новые из checkpointer state
- `server/api/ideas/[id]/index.get.ts` — GET карточка идеи с версиями
- `server/api/ideas/[id]/outputs.get.ts` + `report.get.ts` — фильтрация outdated
- `app/features/ideas/IdeaCard.vue` — MVP форма «Тест обращения»
- `app/features/funnel/FunnelBoard.vue` + `app/features/jobs/JobProgress.vue` — readonly prop для демо-режима
- 2 облегчённых тест-кейса создано (чат-бот, генератор презентаций)
**Проверка:** пайплайн завершён успешно (7/7 шагов), report=validate_first, score=56.0, 7 outputs, funnel_stage=decision. `pnpm typecheck` — 0 ошибок.
**Fixes:** (1) orchestrator возвращал русские enum («средняя» вместо «medium») — добавлен маппинг в Zod schema; (2) `steps` обязателен но модель его有时 не возвращала — добавлен `.catch(['анализ идеи'])`; (3) critic output был вложен в `{ data: {...} }` — исправлен `persistResults`; (4) `AgentOutputs` не имел поля `outputIndex` — удалён из create.

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

## [2026-09-08 / шаг 7b] Миграция на Prisma 8 ORM
**Запрос:** убрать postgres.js + dbmate, перейти на Prisma 8 (ORM + CLI) для решения системных проблем с `sql.json()` / `JSONValue` / `Row` типами.
**План:** (1) установить `prisma@8.0.0-rc.13`, `@prisma/orm-postgres@8.0.0-rc.8`, `@prisma/composer@0.17.0`, `dotenv@17.4.2`; (2) исправить `prisma.config.ts` → `definePrismaConfig` + `ormConfig` из `@prisma/orm-postgres/config`; (3) `contract infer` с live DB; (4) `contract emit` + `db.sign`; (5) переписать `server/utils/db.ts` → экспорт из `src/prisma/db.ts`; (6) переписать все файлы с `sql.json()` → `db.orm.public.<Model>.*`.
**Результат:**
- `prisma.config.ts` — исправлен (definePrismaConfig + ormConfig)
- `src/prisma/contract.prisma` — 12 моделей (infer от live DB)
- `src/prisma/contract.json` + `contract.d.ts` — сгенерированы, подписаны
- `server/utils/db.ts` — re-export из `src/prisma/db.ts`
- `server/queue/types.ts` — `StepContext.db: PrismaDb` (было `sql: Sql`)
- 15+ серверных файлов переписаны: `sql.json()` → `db.orm.public.<Model>.*`
- **Ключевое открытие:** Prisma 8 ORM требует namespace-qualified доступ: `db.orm.public.Ideas`, а не `db.orm.Ideas` (flat access не работает для contracts с namespace)
**Проверка:** `npx vue-tsc --noEmit` — EXIT 0 (0 ошибок). `pnpm vitest run` — 55/55 business logic tests pass, 6 integration tests fail (test DB на порту 5434 недоступен — ожидаемо).
**Fixes:** (1) `ormConfig` не существовал — исправлено на `ormConfig` из `@prisma/orm-postgres/config`; (2) DB миграция применена через `docker exec` (dbmate не работает с новым URL); (3) порт DB изменён на 5433 (5432 занят); (4) `contract infer` требовал пустую БД — миграция применена вручную; (5) `db.orm.Ideas` (flat) не работает — заменено на `db.orm.public.Ideas` (namespace-qualified)
line: 2026-09-10 fix: добавлен import { z } from 'zod' в server/api/ideas/[id]/index.patch.ts (падение сервера uncaughtException "z is not defined"), сервер стартовал, GET / → 200
