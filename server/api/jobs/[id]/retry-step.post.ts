import { db } from '../../../utils/db'
import { retryStep, QueueControlError } from '../../../queue/controls'
import { PIPELINE_STEPS } from '../../../../config/pipeline'

// POST /api/jobs/:id/retry-step — повтор шага (TZ §8).
// Body: { step?: string } — без параметра повторяется последний выполненный шаг.
export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ step?: string }>(event).catch(() => ({}))
  const sql = db()

  try {
    const job = await retryStep(sql, jobId, body?.step, PIPELINE_STEPS)
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
