import { db } from '../../utils/db'
import { parseUuid } from '../../utils/schemas'

// GET /api/jobs/:id — статус задачи очереди (экран «Ход работы», TZ §7a)
export default defineEventHandler(async (event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))

  const job = await db.orm.public.QueueJobs
    .where(f => f.id.eq(jobId))
    .first()
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: 'Задача не найдена' })
  }

  const idea = await db.orm.public.Ideas
    .select('id', 'title', 'funnelStage', 'executionStatus')
    .where(f => f.id.eq(job.ideaId))
    .first()

  return {
    idea: {
      execution_status: idea?.executionStatus ?? null,
      funnel_stage: idea?.funnelStage ?? null,
      id: job.ideaId,
      title: idea?.title ?? null,
    },
    job: {
      attempts: job.attempts,
      current_step: job.currentStep,
      enqueued_at: job.enqueuedAt,
      error: job.error,
      finished_at: job.finishedAt,
      id: job.id,
      idea_id: job.ideaId,
      priority: job.priority,
      started_at: job.startedAt,
      status: job.status,
    },
  }
})
