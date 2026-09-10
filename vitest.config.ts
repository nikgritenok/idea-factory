import { defineConfig } from 'vitest/config'

// Интеграционные тесты (queue/worker/ideas) используют общую тестовую БД
// (TEST_DATABASE_URL / localhost:5434). Параллельный запуск файлов ломает
// изоляцию: beforeEach одного файла удаляет идеи во время прогона другого.
export default defineConfig({
  test: {
    // Интеграционные тесты работают с изолированной тестовой БД (порт 5434).
    // DATABASE_URL переопределяется здесь, а не в .env, чтобы src/prisma/db.ts
    // (и весь код через него) в тестах указывал на ту же БД, что и тестовые
    // ассерты — иначе воркер пишет в dev-БД, а тест проверяет тестовую.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL
        ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test',
    },
    // e2e/*.spec.ts — Playwright-тесты (pnpm e2e), не Vitest.
    exclude: ['e2e/**', '**/node_modules/**'],
    fileParallelism: false,
  },
})
