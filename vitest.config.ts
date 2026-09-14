import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { defineConfig } from 'vitest/config'

/**
 * Ключ LLM нужен llm.test.ts (он мокает fetch, сети нет) — он проверяет и ветку
 * «ключа нет», удаляя переменную явно. Читаем .env точечно и БЕЗ мутации
 * process.env: иначе DATABASE_URL из .env (dev-база 5433) утёк бы в воркеры
 * тестов вместо 5434, и интеграционные тесты писать начали бы в рабочую базу.
 */
const localEnv = dotenv.config({ processEnv: {} }).parsed ?? {}

// Интеграционные тесты (queue/worker/ideas) используют общую тестовую БД
// (TEST_DATABASE_URL / localhost:5434). Параллельный запуск файлов ломает
// изоляцию: beforeEach одного файла удаляет идеи во время прогона другого.
export default defineConfig({
  resolve: {
    // Nuxt-алиасы без Vitest не живут: `~~` → корень, `~` → app/. Пока их не было,
    // ideas/queue/worker не собирались вообще (collection error на «Cannot find module
    // '~~/shared/schemas'») — то есть пайплайн нельзя было проверить ничем, кроме рук.
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app/', import.meta.url)),
    },
  },
  test: {
    // Интеграционные тесты работают с изолированной тестовой БД (порт 5434).
    // DATABASE_URL переопределяется здесь, а не в .env, чтобы src/prisma/db.ts
    // (и весь код через него) в тестах указывал на ту же БД, что и тестовые
    // ассерты — иначе воркер пишет в dev-БД, а тест проверяет тестовую.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL
        ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test',
      LLM_API_KEY: localEnv.LLM_API_KEY ?? localEnv.ROUTERAI_API_KEY,
      ROUTERAI_API_KEY: localEnv.ROUTERAI_API_KEY,
    },
    // e2e/*.spec.ts — Playwright-тесты (pnpm e2e), не Vitest.
    exclude: ['e2e/**', '**/node_modules/**'],
    fileParallelism: false,
  },
})
