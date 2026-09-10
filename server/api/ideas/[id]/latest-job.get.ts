import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/latest-job — последняя задача анализа идеи (для карточки/хода работы)
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  const job = await db.orm.public.QueueJobs
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.enqueuedAt.desc())
    .first()

  if (!job) {
    return { job: null }
  }

  return { job }
})
