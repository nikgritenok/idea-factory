import { useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/outputs — журнал выходов агентов (проверка обоснованности, TZ §4)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const rows = await db.orm.public.AgentOutputs
    .where(f => f.ideaId.eq(ideaId))
    .where(f => f.outdated.eq(false))
    .orderBy(f => f.createdAt.desc())
    .limit(50)
    .all()

  log.set({ outputs: { count: rows.length } })

  return { outputs: rows }
})
