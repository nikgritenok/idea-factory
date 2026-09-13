import { createError, useLogger } from 'evlog'
import { db } from '~~/server/utils/db'

// GET /api/health — healthcheck endpoint для Docker и Caddy
export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  try {
    await db.orm.public.Ideas.select('id').limit(1).all()
    log.set({ health: { db: 'ok' } })
    return {
      db: 'ok',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  }
  catch (error) {
    // Причину пишем в internal: сообщение драйвера Postgres не должно уходить наружу
    // (healthcheck доступен без авторизации). В wide event internal копируется сам.
    throw createError({
      cause: error instanceof Error ? error : undefined,
      code: 'DB_UNAVAILABLE',
      fix: 'Проверить DATABASE_URL в .env и что контейнер idea-factory-db-1 в состоянии Up (healthy)',
      internal: { reason: error instanceof Error ? error.message : String(error) },
      message: 'База данных недоступна',
      status: 503,
      why: 'Пробный SELECT id из Ideas не выполнен — соединение с Postgres не установлено',
    })
  }
})
