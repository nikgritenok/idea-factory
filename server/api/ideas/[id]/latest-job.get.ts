import { useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/latest-job — последняя задача анализа идеи (для карточки/хода работы)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const job = await db.orm.public.QueueJobs
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.enqueuedAt.desc())
    .first()

  if (!job) {
    log.set({ job: { found: false } })
    return { job: null }
  }

  log.set({ job: { id: job.id, status: job.status, step: job.currentStep } })

  return { job }
})
