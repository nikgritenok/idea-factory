import { PIPELINE_STEPS } from '../../../../config/pipeline'
import { QueueControlError, retryStep } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid, RetryStepBodySchema } from '../../../utils/schemas'

// POST /api/jobs/:id/retry-step — повтор шага (TZ §8).
// Body: { step?: string } — без параметра повторяется последний выполненный шаг.
export default defineEventHandler(async (event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch((): unknown => ({}))) as unknown
  const parsed = RetryStepBodySchema.parse(body)
  const sql = db()

  try {
    const job = await retryStep(sql, jobId, parsed.step, PIPELINE_STEPS)
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
