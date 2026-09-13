import { createError, useLogger } from 'evlog'

import { cancelJob, QueueControlError } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/jobs/:id/cancel — отмена задачи (TZ §8)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))

  log.set({ job: { action: 'cancel', id: jobId } })

  try {
    const job = await cancelJob(db, jobId)
    log.set({ job: { id: job.id, status: job.status } })
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({
        cause: error,
        code: error.statusCode === 404 ? 'JOB_NOT_FOUND' : 'JOB_STATE_CONFLICT',
        fix: error.statusCode === 404
          ? 'Обновите список задач — запись могла быть удалена'
          : 'Отменить можно только queued/running: откройте текущий статус задачи',
        message: error.message,
        status: error.statusCode,
        why: 'Отмена отклонена обработчиком очереди',
      })
    }
    throw error
  }
})
