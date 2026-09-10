import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/calculations — расчёты эффективности (экран «Прогоны», TZ §5)
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  const rows = await db.orm.public.Calculations
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.createdAt.desc())
    .limit(10)
    .all()

  return { calculations: rows }
})
