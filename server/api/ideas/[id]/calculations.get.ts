import { useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/calculations — расчёты эффективности (экран «Прогоны», TZ §5)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const rows = await db.orm.public.Calculations
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.createdAt.desc())
    .limit(10)
    .all()

  log.set({ calculations: { count: rows.length } })

  return { calculations: rows }
})
