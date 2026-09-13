import { createError, useLogger } from 'evlog'

import { QueueControlError, resumeJob } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/jobs/:id/resume — продолжение задачи с чекпоинта (TZ §8)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))

  log.set({ job: { action: 'resume', id: jobId } })

  try {
    const job = await resumeJob(db, jobId)
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
          : 'Продолжить можно задачу в статусе paused; упавшую повторите через «повторить шаг»',
        message: error.message,
        status: error.statusCode,
        why: 'Продолжение отклонено обработчиком очереди',
      })
    }
    throw error
  }
})
