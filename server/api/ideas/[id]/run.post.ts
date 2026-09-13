import { createError, useLogger } from 'evlog'

import { QueueControlError } from '../../../queue/controls'
import { enqueueIdeaAnalysis } from '../../../queue/enqueue'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/ideas/:id/run — запуск анализа идеи (TZ §8).
// Идемпотентно: повторный клик возвращает существующую активную задачу, не создавая дубль.
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { action: 'run', id: ideaId } })

  try {
    const { created, job } = await enqueueIdeaAnalysis(db, ideaId)
    log.set({ job: { created, id: job.id, status: job.status } })
    setResponseStatus(event, created ? 201 : 200)
    return { created, job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      // enqueueIdeaAnalysis знает ровно две причины: нет строки идеи (404) и идея в архиве (409)
      throw createError({
        cause: error,
        code: error.statusCode === 404 ? 'IDEA_NOT_FOUND' : 'IDEA_ARCHIVED',
        fix: error.statusCode === 404
          ? 'Обновите доску — идея могла быть удалена, пока карточка была открыта'
          : 'Снимите идею с архива на доске и повторите запуск',
        message: error.message,
        status: error.statusCode,
        why: 'Очередь не приняла задачу: идея недоступна для запуска',
      })
    }
    throw error
  }
})
