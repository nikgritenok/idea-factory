import { QueueControlError } from '../../../queue/controls'
import { enqueueIdeaAnalysis } from '../../../queue/enqueue'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/ideas/:id/run — запуск анализа идеи (TZ §8).
// Идемпотентно: повторный клик возвращает существующую активную задачу, не создавая дубль.
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  try {
    const { created, job } = await enqueueIdeaAnalysis(db, ideaId)
    setResponseStatus(event, created ? 201 : 200)
    return { created, job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
