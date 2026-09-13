# Coding Conventions — Vue 3 / Nuxt 4 (Nitro) / Node.js

These rules are mandatory for all agents and developers. For high-level agent behavior, see `AGENTS.md`.

## 1. General Principles

- Be conservative, explicit, and boring. Prefer the predictable solution.
- When unsure, ask — don't guess.
- Make minimal, targeted changes. Never refactor unrelated code.
- Preserve existing structure, conventions, and tooling.
- TypeScript strict mode (`strict: true` + `noUncheckedIndexedAccess`).
- Composition API + `<script setup lang="ts">` only.
- Never use `any`. Use `unknown` + narrowing or Zod.
- Named exports by default (exceptions: Nuxt pages and layouts).

## 2. Naming

| What                       | Style                          | Example                          |
|----------------------------|--------------------------------|----------------------------------|
| Variables / functions      | camelCase                      | `getUserById`, `isLoading`       |
| Components                 | PascalCase                     | `UserCard.vue`, `AppHeader.vue`  |
| Composables                | camelCase + `use` prefix       | `useAuth.ts`, `useUserForm.ts`   |
| Types / interfaces         | PascalCase                     | `User`, `CreateUserDto`          |
| Constants                  | SCREAMING_SNAKE_CASE           | `API_BASE_URL`                   |
| Files (except components)  | kebab-case                     | `user-service.ts`                |
| Booleans                   | `is`/`has`/`can`/`should`      | `isLoading`, `hasError`          |
| Event handlers             | `on` + Event                   | `onSubmit`, `onUpdate:modelValue`|

## 3. Project Structure (Nuxt 4)

```
app/                  # frontend (Vue)
  features/           # Feature-based organization (components + composables + tests)
    ideas/            # Each feature: .vue + .ts composable + .spec.ts
    funnel/
    create-idea/
    voice-input/
  components/         # Shared UI primitives only (buttons, inputs, cards)
    ui/               # shadcn-vue components
  composables/        # Global composables (useAuth, useToast)
  pages/              # Thin wrappers: <FeatureName /> only
  layouts/
  middleware/
  utils/
server/               # Nitro backend
  api/                # API routes (server/api/**)
  utils/
    api/              # API helpers (error.ts, etc.)
  queue/              # Queue worker + LangGraph
  plugins/            # Nitro plugins
shared/               # Code shared between app/ and server/
  schemas/            # Zod schemas — single source of truth
  types/
  utils/
config/               # Pipeline config (roles, steps, queue params)
```

### Rules

- **Feature folders**: all user-facing features live in `app/features/<name>/`. Each contains its component, composable, and tests.
- **Pages are thin**: `app/pages/` files are 1-3 line wrappers that render a feature component. No logic in pages.
- **Shared schemas**: all Zod schemas and shared types live in `shared/schemas/`. Never import from `server/utils/schemas` in new code — use `~~/shared/schemas`.
- **No duplication**: never duplicate types between `app/` and `server/`.
- **No deep imports**: no `../../..`. Use path aliases (`~~/`, `~/`).

## 4. Vue / Nuxt Rules

- Always use `<script setup lang="ts">`. Options API is forbidden.
- Type props and emits via `defineProps` / `defineEmits` (`withDefaults` when needed).
- Use `defineModel` for two-way binding (Vue 3.4+).
- Composables return reactive state + methods (no classes).
- Use Nuxt auto-imports, but prefer explicit imports in complex code for readability.
- Pages and layouts: default export (Nuxt requirement).
- Components and utilities: named export preferred.

Example component:

```vue
<script setup lang="ts">
interface Props {
  userId: string
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: 'User'
})

const emit = defineEmits<{
  (e: 'update', id: string): void
}>()
</script>
```

## 5. Nitro / Server (Backend)

- API routes: `server/api/**/*.ts` (file-based).
- Validate all incoming data with Zod at the boundary (start of the handler).
- Business logic lives in `server/utils/` or `server/services/`.
- Handlers stay thin: validate → call service → return.
- Errors: `createError` из `evlog` (явный импорт), всегда с `code`, `why` и `fix`. См. «Error format» ниже.
- No side effects at module top level.
- Schemas: import from `~~/shared/schemas`, not from `server/utils/schemas`.

### Error format

Ошибку кидает сам роут, хелперов-обёрток нет — evlog-ошибка и есть контракт.
Авто-импорт `createError` в Nuxt указывает на h3-версию, она теряет `why`/`fix`/`link`,
поэтому импорт в обработчиках явный.

```ts
import { createError, useLogger } from 'evlog'

const log = useLogger(event)

throw createError({
  code: 'IDEA_NOT_FOUND',          // стабильный машинный идентификатор
  message: 'Идея не найдена',       // человекочитаемо, безопасно для клиента
  status: 404,
  why: `В таблице Ideas нет записи с id=${ideaId}`,
  fix: 'Вернитесь на доску и откройте существующую идею',
  internal: { reason },            // только в wide event: ответы драйверов, stdout шагов
})
```

Ответ клиенту (сериализует error-handler evlog):

```json
{ "status": 404, "statusCode": 404, "message": "Идея не найдена",
  "data": { "code": "IDEA_NOT_FOUND", "why": "…", "fix": "…" } }
```

`internal` в теле не появляется. Клиент читает ответ через `parseError` из `evlog`
(авто-импорт), а не руками по `err.data.error.message`.

### Example API route

```ts
// server/api/ideas/[id].get.ts
import { createError, useLogger } from 'evlog'

import { getIdeaById } from '~~/server/utils/ideas'
import { parseUuid } from '~~/shared/schemas'

export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const id = parseUuid(getRouterParam(event, 'id'))
  log.set({ idea: { id } })

  const idea = await getIdeaById(id)
  if (!idea) {
    throw createError({
      code: 'IDEA_NOT_FOUND',
      fix: 'Вернитесь на доску и откройте существующую идею',
      message: 'Идея не найдена',
      status: 404,
      why: `В таблице Ideas нет записи с id=${id}`,
    })
  }

  return { idea }
})
```

Пользовательский текст (транскрипт, текст обращения, аудио) в `log.set()` не кладётся —
только идентификаторы и размеры.

## 6. TypeScript

- `interface` for object shapes and public API shapes.
- `type` for unions, utility types, mapped types.
- Explicit return types on all exported functions.
- `import type` for type-only imports.
- Prefer `readonly` / `ReadonlyArray` where practical.
- Narrow with type guards; avoid `as` assertions and `!` except as a last resort.
- Prefer exhaustive handling of unions with `never` checks.
- Treat caught errors as `unknown` and narrow before use.

## 7. Async & Error Handling

- `async/await` only. Floating promises are forbidden.
- Rethrow with context; preserve `cause` when available. Never throw strings.
- Never swallow rejections or errors.
- Client: handle via `useError` / `showError` or the project error boundary.
- Server: `createError({ code, message, status, why, fix, internal? })` из `evlog`; то, что нельзя показывать клиенту, — в `internal`.

## 8. Runtime & Environment (Node.js)

- Target the repo's supported Node LTS (check config/docs; don't assume versions).
- No top-level side effects (I/O, network, env reads, global mutations) unless explicitly intended.
- Env vars: validate centrally once at startup via Zod (`server/utils/env.ts`); read at runtime, not import time; never mutate env in app code (tests only, with scoped setup/teardown).
- Library code must not log. CLIs may log intentionally, with consistent exit codes.

## 9. Logging & Security

- Never log secrets (tokens, keys, passwords, personal data).
- Validate/sanitize all external inputs: paths, URLs, user data (Zod at boundaries).
- No `console.log` in production code. В `server/` логирование только через evlog: в HTTP-роутах
  `useLogger(event)` + `log.set()` (одно широкое событие на запрос), вне запроса — `log.info/error`.
  Пользовательский текст (транскрипт, текст обращения, аудио) в событие не кладётся — идентификаторы
  и размеры.

## 10. Testing (Vitest)

- New business logic requires tests. Exceptions: types-only code, re-exports, comments/formatting.
- Tests must be deterministic and isolated; no shared mutable state.
- Prefer behavioral tests; mock sparingly.
- Cover failure paths, not only happy paths.
- Bug fixes must include a regression test.
- No committed `.only` / `.skip` unless explicitly justified.
- Avoid snapshots unless they add clear value and are stable.
- Unit: Vitest. Components: `@vue/test-utils` + Vitest. API: `nitro-test` or plain HTTP tests.
- Tests are co-located: `*.test.ts` / `*.spec.ts`.

## 11. Доступность (a11y)

Требование остаётся (TZ.md §6): работа с клавиатуры, видимый фокус, подписи полей, статус понятен
без цвета, на 390px основные действия без горизонтальной прокрутки.

Автоматические проверки сняты по решению владельца от 2026-09-13: из репозитория убраны
`eslint-plugin-vuejs-accessibility` (линтер), `@nuxt/a11y` (скан в DevTools) и
`e2e/accessibility.spec.ts` вместе с `@axe-core/playwright`. Честное следствие: регресс
доступности больше не ловится машиной — зелёный `pnpm e2e` не означает, что a11y не сломана.

Как проверяем без сканера:

- **Разметка — часть ревью диффа.** `aria-*`, `role`, `label`/`for`, `alt` смотрим в коде; интерактив
  берём только из `app/components/ui/*` (reka-ui), где клавиатура и фокус реализованы примитивом.
- **Клавиатурный проход в ритуале осмотра** (§15): Tab по всем состояниям экрана, фокус виден на каждом
  шаге, оверлей возвращает фокус и закрывается по Esc.
- **Контраст считается по парам токенов** `DESIGN.md` (§Colors), а не на глаз: новый hex внутри
  компонента — непроверенная пара, поэтому он и запрещён.
- **Статус читается текстом:** состояния (пусто / ошибка / загрузка) покрыты `pnpm test`, а не только
  цветом рамки.

Что нашёл сканер и остаётся исправленным после его удаления: `<html lang="ru">` — без языка документа
скринридер читает русскую разметку латинской раскладкой.

## 12. Comments, Docs & Dependencies

### Comments & docs

- Update docs/comments whenever behavior changes.
- Comments explain "why", not "what".

### Dependencies

- Never add dependencies without explicit approval.
- A justification must cover: need, alternatives, maintenance burden, license, security impact.

## 13. Strictly Prohibited

- Options API
- `any`, `@ts-ignore`, unjustified `// @ts-expect-error`
- Default exports in components and utilities (except pages/layouts)
- Editing already-applied migrations
- Adding dependencies without approval
- `console.log` in production code
- Deep relative imports (`../../../`)
- Module-level side effects
- Duplicating types between `app/` and `server/`
- Changing public APIs or introducing breaking changes without explicit instruction
- Stylistic rewrites and micro-optimizations

## 14. Verify Before Committing

- Typecheck + lint + tests pass.
- New behavior has coverage, including failure paths.
- No unintended snapshot changes.
- No unnecessary diff churn.
- No accidental top-level side effects.
- Env usage is validated and intentional.

## 15. Дизайн и движение (motion-v + impeccable)

Фронтенд собирается из четырёх слоёв, каждый со своим источником истины:

| Слой | Инструмент | Истина | Можно ли изобретать руками |
| --- | --- | --- | --- |
| Интерактивные паттерны | `reka-ui` через `app/components/ui/*` (shadcn-vue) | исходник компонента в репо | **Нет.** Свой dialog/menu/tabs/select/tooltip — это баг, а не компонент |
| Визуальные токены | `DESIGN.md` | `DESIGN.md` frontmatter → `app/assets/css/tailwind.css` (`@theme`) | Нет.Hex в компонентах только если токена нет |
| Движение | `motion-v` | этот раздел + `.agents/skills/motion/best-practices/vue.md` | Только внутри списка ниже |
| Вкус и проверка | skill `impeccable` + `agent-browser` (захват доказательств) + субагент `impeccable-finish-reviewer` (вердикт) | `.agents/skills/impeccable/reference/`, `.impeccable/review/` | Нет. Цикл проверки обязательный, вердикт дизайна — не руками построившего экран |

### Motion: allowed properties

`MotionConfig` стоит в `app/app.vue` и задаёт политику на всё дерево.

- Разрешено анимировать: `transform` (`x/y/scale/rotate`), `opacity`, `filter`, `clip-path`, `mask`. Это compositor-уровень, он не дёргает layout.
- Запрещено: `width`, `height`, `margin`, `padding`, `gap`, `top/left`, `font-size` (перестройка layout каждый кадр); CSS-переменная на `:root` («плавный theme switch» этим способом — самый частый self-inflicted jank); `transition: all`; `repeat: Infinity` у элемента, который может быть вне вьюпорта (ворот `whileInView`); `layout`/`layoutId` внутри списков длиннее ~20 узлов.
- Четыре глагола, другого не изобретаем: `state` (`:animate`, `whileHover/whilePress/whileFocus`), `enter` (`whileInView` + `clip-path`/mask-reveal, stagger 40–60 ms), `shared` (`layout`, `layoutId`, `LayoutGroup`), `scroll-linked` (`useScroll` + `useTransform` → `:style`).
- Продуктовые экраны (funnel, таблицы прогонов, настройки, форма создания идеи) = `state` + короткий `enter`. `scroll-linked` и `shared` — только на persuading-поверхностях (лендинг, витрина).
- Auto-import покрывает `Motion`, `AnimatePresence`, `LayoutGroup`, `MotionConfig`, `ReorderGroup/Item`, `M` и хуки (`useScroll`, `useTransform`, `useReducedMotion`, …). Строчечный `motion.div` **не** авто-импортируется — `import { motion } from 'motion-v'`.
- `skipAnimations` в `MotionConfig` для declarative-компонентов не использовать: в `motion-v@2.4.2` он доходит только до императивного `useAnimate`.

### Capture-режим

`?motion=off` → `reducedMotion: "always"` → transform/layout выключены. Нужен для того, чтобы скриншот и клавиатурный проход не зависели от тайминга.

- `opacity`-анимации он не глушит: перед снимком ждать успокоения кадра (`networkidle` + один `requestAnimationFrame`, либо `waitForFunction` на отсутствие `[data-animating]`), иначе дифф флапает.
- Ручная проверка: `pnpm dev`, затем `agent-browser` на `http://localhost:3000/<route>?motion=off`, desktop (1440) и mobile (360) в одном проходе, файлами в `.impeccable/review/` (`desktop.png`, `mobile.png`) — это вход для ревьюера, а не иллюстрация к отчёту.
- Гигиена захвата (проверено на живом экране): путь к скрину — **абсолютный** (относительный `screenshot --full ./x.png` CLI принимает за селектор и молча кладёт файл в свой tmp-каталог); островок DevTools удалять из DOM перед снимком — `eval "document.getElementById('nuxt-devtools-container')?.remove()"`, иначе он попадает и в кадр, и в скан; экран с `position: fixed` (мобильная таб-панель) снимать **двумя вьюпортами** — scroll 0 и document end, а не `--full`: полностраничный скрин рисует фиксированный бар посреди документа, и по нему «окклюзия» выглядит правдой, хотя измерение даёт 39px запаса.

### Цикл проверки одного UI-задания (bounded passes)

1. Прочитать `DESIGN.md` (он и так в `instructions`), определить режим поверхности: `persuade` / `operate` / `read`.
2. Построить полностью, не полируя по ходу.
3. **Один** пакетный осмотр: capture-скрин desktop + mobile, `impeccable detect` по изменённым файлам, замечания critique.
4. **Один** пакет фиксов по всем найденным дефектам сразу.
5. **Один** подтверждающий скрин теми же файлами.
6. **Один** вызов субагента `impeccable-finish-reviewer` — свежий контекст, вне цикла полировки. Вход: скриншоты обеих вьюпортов, режим поверхности, токены `DESIGN.md`, findings детектора, диффы. Выход: `disposition: ship|fix|rebuild|recapture` + `material_fixes` (≤8, по убыванию значимости) + `keep`. Его `disposition` передаётся человеку дословно, смягчать нельзя; `material_fixes` — одним пакетом.
7. Порог выхода: `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e` зелёные + DEVLOG-строка с ручным наблюдением.

Бесконечная само-полировка — это баг процесса: она жжёт бюджет и делает хуже, чем шаг 3–5.

О дизайн-целом судит не тот контекст, который строил поверхность: он наследует её оптимизм и абстракции. Отдельный
`impeccable-finish-reviewer` (`.opencode/agents/impeccable-finish-reviewer.md`, портирован из Codex-формата скилла
`impeccable`) читает только пакет входов и потому ловит иерархию, «дешёвый вид» и отход от contract там, где
детектор механически слеп. Нет скриншотов — `recapture`, частичного ревью по сломанным доказательствам не бывает.
OpenCode не входит в список харнесов, куда `impeccable` ставит свой post-tool-use хук, поэтому механический скан
в конце цикла обязателен руками (шаг 3), а не «когда вспомним».

### Что требует сети (и потому не входит в цикл)

- `impeccable context` / `detect` дёргают лаунчер, который один раз скачивает бинарь с `impeccable.style`. Без него скилл работает в degraded-режиме: читает `PRODUCT.md`/`DESIGN.md` напрямую, механические проверки прогоняются руками.
- Motion MCP (хостед) — только поиск по актуальным докам; правила для записи кода лежат локально в `.agents/skills/motion/best-practices/`.
- `web-design-guidelines` подтягивает список правил из сети на каждый запуск — в этом репо его заменяют механический `impeccable detect` + ревью разметки и клавиатурный проход (§11).
- `skills-lock.json` фиксирует версии скиллов: обновление — осознанный коммит, а не рантайм-зависимость.

## 16. Ветка задания и мёрдж в `main`

`main` — ветка, из которой собирается публичный стенд (AGENTS.md → «Deploy to production»). Границы
«коммит» и «деплой» не должны совпадать: в ветке коммитим часто и смело, в `main` попадает только
проверенное задание целиком, и только когда человек сказал «да».

### Что заводит ветку

Ветка обязательна, если дифф задевает исполняемое:

```
app/  server/  shared/  config/  e2e/  migrations/  src/prisma/
package.json  pnpm-lock.yaml  Dockerfile  docker-compose*.yml
nuxt.config.ts  prisma.config.ts  vitest.config.ts  playwright.config.ts  eslint.config.mjs  .env.example
```

Вне ветки, прямым коммитом в `main`: `*.md`, `.agents/skills/**`, `skills-lock.json`, `.opencode/**`,
`.impeccable/**` — всё, что не попадает в образ и не меняет поведение стенда.

Префикс коммита ориентиром **не** служит: в истории есть `chore(deploy): compose-манифест для Dokploy…`
(`04b6421`), который менял весь прод-стек. Порог — по файлам в диффе, а не по слову в заголовке.

### Порядок

1. Первой командой задания — `git switch -c <type>/<slug>`, где `<type>` совпадает с префиксом коммита
   (`feat/queue-priority`). Одна активная ветка за раз: предыдущая смёржена или удалена до того, как
   открыта следующая.
2. Перед первым коммитом — напечатать фактическое состояние: `git rev-parse --abbrev-ref HEAD` и его
   вывод. Требование того же класса, что «прогоны показывать, а не предполагать»: «мы же на ветке» без
   строки-доказательства не принимается.
3. Внутри ветки — обычная дисциплина §14 (коммит на каждый шаг, `pnpm lint && pnpm typecheck && pnpm test`).
   Ветку пушим в `origin` (`git push -u origin <branch>`): рабочая машина одна, единственная вне-машинная
   копия — GitHub, а review-дифф человеку удобнее смотреть там (`…/compare/main...<branch>`).
4. Мёрдж — после явного «да» человека (TZ.md §14) и только по прогону **не хуже baseline** на актуальном
   `main`: `git fetch origin && git rebase origin/main` → заново §14-проверку (rebase делает предыдущий
   прогон недействительным) → `git switch main && git merge --ff-only <branch>`.
5. `git push origin main` — деплой-акт (см. оговорку про webhook в AGENTS.md: триггер стенда из репозитория
   подтвердить не удалось, до проверки в панели push считать подготовкой релиза).
6. Убрать за собой: `git branch -d <branch>` и `git push origin --delete <branch>`. Имя ветки — в
   DEVLOG-строку задания: граница задания читается в DEVLOG, а не в графе истории.
7. `--force`/`--force-with-lease` на `main` запрещены всегда. Переписывать историю можно только внутри
   своей ветки до мёрджа.

### Baseline, а не «зелёный»

Гейт сформулирован как «не хуже baseline», потому что прогон не зелёный и не будет зелёным молча.
Замерено на `main` после мёрджа `chore/replace-sentry-with-evlog` (2026-09-14, дерево идентично
проверенной ветке — мёрдж был `--ff-only` без конфликтов, гейт переснят до пуша):

| Команда | Факт |
| --- | --- |
| `pnpm lint` | 37 errors / 0 warnings, exit 1 |
| `pnpm typecheck` | exit 0 (шум — `NUXT_B3011` WARN про дубли имён `Ui*` и дублированный импорт `IDEA_LIMIT_ACTIVE`, это не `error TS`) |
| `pnpm test` | 6 failed / 60 passed; падают `server/`-тесты, требующие `ROUTERAI_API_KEY` («LLM-ключ не настроен на сервере») |
| `pnpm e2e` | 3 passed |

История числа для контекста: до задания на `main` (`c8b7337`, 2026-09-13) было 157 errors / 5 warnings
и 6 failed / 52 passed. Разрыв 157 → 37 — не «стало чисто»: вычищен шум (`perfectionist`,
Formatting- и `sonarjs/prefer-*`-правила, `security/detect-non-literal-*`) и один класс ложных
срабатываний из-за неверной настройки `projectService` (DEVLOG шаги 19–20).

Остаток 37 — долг, а не чистота: 36 ошибок в `server/queue/**` (в основном `as unknown as JobRow` на
строках Prisma и `any` в jsonb протокола прогона) плюс `max-lines` в `IdeaCard.vue`. Правки там меняют
типы данных очереди, а `queue.test.ts`/`worker.test.ts` красные и до, и после (нужен `ROUTERAI_API_KEY`),
то есть проверить «не сломал воркер» на зелёном сейчас нельзя — оставлено с разбивкой в DEVLOG шаг 20.

Значит мёрдж не добавляет ни одного нового падения и ни нового lint-error; починенное отмечается в DEVLOG
и двигает baseline вниз. Когда строка перестанет совпадать с реальностью — обновить её прогоном на `main`,
а не «на глаз».

### Почему linear (`--ff-only`), а не merge-коммиты

CI в репозитории нет (`.github/workflows` отсутствует, из хуков только husky `pre-commit` →
`lint-staged` по `*.{ts,vue,mjs}`), ревьюера у PR тоже нет. Merge-нод зафиксировал бы только то, что
агент сам себе утвердил работу. Ценная детализация уже в истории: «одно задание = несколько коммитов со
ссылкой на TZ §», и `fix:`-коммитов (21 из 87) в ней больше, чем откатов — историю чинят прогоном вперёд,
а не revert всего задания. Цена linear-истории — обязательный rebase и повторный прогон после него; если
это начнёт стоить дороже, чем польза, переходим на `--no-ff`, а не на полу-линейную историю.

### Одна БД на все ветки

Dev-Postgres один (`idea-factory-db-1`, порт 5433) и за переключением ветки не мигрирует. Поэтому:

- rebase/мёрдж принёс новую миграцию — сразу `pnpm db:migrate`, а не «надеяться, что схема та же»;
- вторая параллельная ветка с изменением схемы запрещена: `migrations/app/refs/db.json` и content-hash
  снапшоты в `migrations/snapshots/` на двух независимых линиях расходятся, и чинится это ручным разбором
  уже применённой миграции — тем, что §13 запрещает;
- ветка, которая меняет схему, мёрджится до того, как открывается следующая задача со схемой.
