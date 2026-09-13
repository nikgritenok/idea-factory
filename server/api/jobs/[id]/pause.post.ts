import { createError, useLogger } from 'evlog'

import { pauseJob, QueueControlError } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/jobs/:id/pause — пауза задачи (TZ §8)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))

  log.set({ job: { action: 'pause', id: jobId } })

  try {
    const job = await pauseJob(db, jobId)
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
          : 'На паузу ставят только queued/running: дождитесь завершения или продолжите задачу',
        message: error.message,
        status: error.statusCode,
        why: 'Пауза отклонена обработчиком очереди',
      })
    }
    throw error
  }
})
