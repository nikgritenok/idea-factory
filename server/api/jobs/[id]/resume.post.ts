import { QueueControlError, resumeJob } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// POST /api/jobs/:id/resume — продолжение задачи с чекпоинта (TZ §8)
export default defineEventHandler(async (event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))

  try {
    const job = await resumeJob(db, jobId)
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
