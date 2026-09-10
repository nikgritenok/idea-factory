import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/runs — прогоны и журнал вызовов (экран «Прогоны», TZ §9)
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  const runs = await db.orm.public.Runs
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.startedAt.desc())
    .limit(20)
    .all()

  const runIds = runs.map(r => r.id)
  const calls = runIds.length
    ? await db.orm.public.RunCalls
        .where(f => f.runId.in(runIds))
        .orderBy(f => f.createdAt.desc())
        .limit(30)
        .all()
    : []

  return { calls, runs }
})
