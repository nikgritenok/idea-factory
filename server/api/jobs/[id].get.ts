import { createError, useLogger } from 'evlog'

import { db } from '../../utils/db'
import { parseUuid } from '../../utils/schemas'

// GET /api/jobs/:id — статус задачи очереди (экран «Ход работы», TZ §7a)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))

  log.set({ job: { id: jobId } })

  const job = await db.orm.public.QueueJobs
    .where(f => f.id.eq(jobId))
    .first()
  if (!job) {
    throw createError({
      code: 'JOB_NOT_FOUND',
      fix: 'Обновите экран «Ход работы» — задача могла быть снята с очереди',
      message: 'Задача не найдена',
      status: 404,
      why: `В QueueJobs нет строки с id=${jobId}`,
    })
  }

  log.set({ job: { ideaId: job.ideaId, status: job.status, step: job.currentStep } })

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
