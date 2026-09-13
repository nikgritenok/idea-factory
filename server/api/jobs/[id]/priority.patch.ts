import { createError, useLogger } from 'evlog'

import { QueueControlError, setJobPriority } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid, PriorityBodySchema } from '../../../utils/schemas'

// PATCH /api/jobs/:id/priority — смена приоритета задачи и идеи (TZ §8)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch((): unknown => ({}))) as unknown
  const parsed = PriorityBodySchema.parse(body)

  log.set({ job: { action: 'priority', id: jobId, priority: parsed.priority } })

  try {
    const job = await setJobPriority(db, jobId, parsed.priority)
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
          : 'Приоритет меняют задаче, которая ещё не завершилась; запустите её заново из карточки идеи',
        message: error.message,
        status: error.statusCode,
        why: 'Смена приоритета отклонена обработчиком очереди',
      })
    }
    throw error
  }
})
