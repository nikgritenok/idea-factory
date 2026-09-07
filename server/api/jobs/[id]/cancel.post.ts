import { cancelJob, QueueControlError } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/jobs/:id/cancel — отмена задачи (TZ §8)
export default defineEventHandler(async (event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))
  const sql = db()

  try {
    const job = await cancelJob(sql, jobId)
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
