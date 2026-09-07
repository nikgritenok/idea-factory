import { db } from '../../../utils/db'
import { setJobPriority, QueueControlError } from '../../../queue/controls'
import type { QueuePriority } from '../../../queue/types'

// PATCH /api/jobs/:id/priority — смена приоритета задачи и идеи (TZ §8)
export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ priority?: string }>(event).catch(() => ({}))
  const sql = db()

  const priority = body?.priority
  if (priority !== 'high' && priority !== 'medium' && priority !== 'low') {
    throw createError({ statusCode: 400, statusMessage: 'Приоритет должен быть high, medium или low' })
  }

  try {
    const job = await setJobPriority(sql, jobId, priority as QueuePriority)
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
