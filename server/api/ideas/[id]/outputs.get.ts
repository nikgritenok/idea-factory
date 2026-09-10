import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/outputs — журнал выходов агентов (проверка обоснованности, TZ §4)
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  const rows = await db.orm.public.AgentOutputs
    .where(f => f.ideaId.eq(ideaId).and(f.outdated.eq(false)))
    .orderBy(f => f.createdAt.desc())
    .limit(50)
    .all()

  return { outputs: rows }
})
