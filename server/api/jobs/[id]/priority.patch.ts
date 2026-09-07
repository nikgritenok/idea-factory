import { db } from '../../../utils/db'
import { setJobPriority, QueueControlError } from '../../../queue/controls'
import { parseUuid, PriorityBodySchema } from '../../../utils/schemas'

// PATCH /api/jobs/:id/priority — смена приоритета задачи и идеи (TZ §8)
export default defineEventHandler(async (event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))
  const body = (await readBody(event).catch((): unknown => ({}))) as unknown
  const parsed = PriorityBodySchema.parse(body)
  const sql = db()

  try {
    const job = await setJobPriority(sql, jobId, parsed.priority)
    return { job }
  }
  catch (error) {
    if (error instanceof QueueControlError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    throw error
  }
})
