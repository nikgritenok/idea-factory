import { db } from '../../utils/db'
import type { JobRow } from '../../queue/types'

// GET /api/jobs/:id — статус задачи очереди (экран «Ход работы», TZ §7a)
export default defineEventHandler(async (event) => {
  const jobId = getRouterParam(event, 'id') ?? ''
  const sql = db()

  const [job] = await sql`
    select j.*, i.title as idea_title, i.funnel_stage, i.execution_status
    from queue_jobs j
    join ideas i on i.id = j.idea_id
    where j.id = ${jobId}`
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Задача не найдена' })
  }
  const jobRow = job as JobRow & { idea_title: string, funnel_stage: string, execution_status: string }

  return {
    job: {
      id: jobRow.id,
      idea_id: jobRow.idea_id,
      priority: jobRow.priority,
      status: jobRow.status,
      attempts: jobRow.attempts,
      current_step: jobRow.current_step,
      enqueued_at: jobRow.enqueued_at,
      started_at: jobRow.started_at,
      finished_at: jobRow.finished_at,
      error: jobRow.error,
    },
    idea: {
      id: jobRow.idea_id,
      title: jobRow.idea_title,
      funnel_stage: jobRow.funnel_stage,
      execution_status: jobRow.execution_status,
    },
  }
})
