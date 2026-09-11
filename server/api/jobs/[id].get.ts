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
      executionStatus: idea?.executionStatus ?? null,
      funnelStage: idea?.funnelStage ?? null,
      id: job.ideaId,
      title: idea?.title ?? null,
    },
    job: {
      attempts: job.attempts,
      currentStep: job.currentStep,
      enqueuedAt: job.enqueuedAt,
      error: job.error,
      finishedAt: job.finishedAt,
      id: job.id,
      ideaId: job.ideaId,
      priority: job.priority,
      startedAt: job.startedAt,
      status: job.status,
    },
  }
})
