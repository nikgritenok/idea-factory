import { createError, useLogger } from 'evlog'

import { PIPELINE_STEPS } from '../../../../config/pipeline'
import { QueueControlError, retryStep } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid, RetryStepBodySchema } from '../../../utils/schemas'

// POST /api/jobs/:id/retry-step — повтор шага (TZ §8).
// Body: { step?: string } — без параметра повторяется последний выполненный шаг.
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch((): unknown => ({}))) as unknown
  const parsed = RetryStepBodySchema.parse(body)

  log.set({ job: { action: 'retry-step', id: jobId, step: parsed.step ?? 'last-completed' } })

  try {
    const job = await retryStep(db, jobId, parsed.step, PIPELINE_STEPS)
    log.set({ job: { id: job.id, status: job.status } })
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      // retryStep знает четыре отказа: нет задачи (404), выполняется (409),
      // шаг не указан (400) и шаг вне пайплайна (400)
      let code = 'PIPELINE_STEP_INVALID'
      if (error.statusCode === 404) {
        code = 'JOB_NOT_FOUND'
      }
      else if (error.statusCode === 409) {
        code = 'JOB_STATE_CONFLICT'
      }

      throw createError({
        cause: error,
        code,
        fix: error.statusCode === 409
          ? 'Сначала поставьте задачу на паузу или отмените, затем повторите шаг'
          : `Передайте шаг из пайплайна: ${PIPELINE_STEPS.map(s => s.id).join(', ')}`,
        message: error.message,
        status: error.statusCode,
        why: 'Повтор шага отклонён обработчиком очереди',
      })
    }
    throw error
  }
})
