import { db } from '../../../utils/db'
import { enqueueIdeaAnalysis } from '../../../queue/enqueue'
import { QueueControlError } from '../../../queue/controls'

// POST /api/ideas/:id/run — запуск анализа идеи (TZ §8).
// Идемпотентно: повторный клик возвращает существующую активную задачу, не создавая дубль.
export default defineEventHandler(async (event) => {
  const ideaId = getRouterParam(event, 'id') ?? ''
  const sql = db()

  try {
    const { job, created } = await enqueueIdeaAnalysis(sql, ideaId)
    setResponseStatus(event, created ? 201 : 200)
    return { job, created }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
