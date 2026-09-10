import { db } from '~~/server/utils/db'

// GET /api/health — healthcheck endpoint для Docker и Caddy
export default defineEventHandler(async () => {
  try {
    // Простой запрос через ORM — проверяем соединение с БД
    await db.orm.public.Ideas.select('id').limit(1).all()
    return {
      db: 'ok',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }
  }
  catch {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database unreachable',
    })
  }
})
