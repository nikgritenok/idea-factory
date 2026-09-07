# Coding Conventions — Vue 3 / Nuxt 3 (Nitro) / Node.js

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

## 3. Project Structure (Nuxt 3)

```
app/                  # frontend (Vue)
  components/         # UI components
  composables/        # reusable logic
  pages/              # file-based routing
  layouts/
  middleware/
  utils/
server/               # Nitro backend
  api/                # API routes (server/api/**)
  routes/             # additional server routes
  utils/
  services/           # business logic
  middleware/
shared/               # code shared between app/ and server/
  types/
  schemas/            # Zod schemas
  utils/
```

- Shared types and Zod schemas → `shared/` only.
- Backend business logic → `server/utils/` or `server/services/`.
- Never duplicate types between frontend and backend.
- No deep relative imports (`../../..`). Use path aliases.

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
- Errors: use `createError` from h3. Never swallow errors.
- No side effects at module top level.

Example API route:

```ts
// server/api/users/[id].get.ts
import { z } from 'zod'
import { getUserById } from '~~/server/utils/users'

const paramsSchema = z.object({
  id: z.string().uuid()
})

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, paramsSchema.parse)
  return getUserById(id)
})
```

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
- Server: `createError({ statusCode, statusMessage, data })`.

## 8. Runtime & Environment (Node.js)

- Target the repo's supported Node LTS (check config/docs; don't assume versions).
- No top-level side effects (I/O, network, env reads, global mutations) unless explicitly intended.
- Env vars: validate centrally once at startup via Zod (`server/utils/env.ts`); read at runtime, not import time; never mutate env in app code (tests only, with scoped setup/teardown).
- Library code must not log. CLIs may log intentionally, with consistent exit codes.

## 9. Logging & Security

- Never log secrets (tokens, keys, passwords, personal data).
- Validate/sanitize all external inputs: paths, URLs, user data (Zod at boundaries).
- No `console.log` in production code.

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

## 11. Comments & Docs

- Update docs/comments whenever behavior changes.
- Comments explain "why", not "what".

## 12. Dependencies

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
