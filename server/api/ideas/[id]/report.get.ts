import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/report — последняя версия отчёта (экран «Отчёт», TZ §7a)
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  const report = await db.orm.public.Reports
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.version.desc())
    .first()

  return { report }
})
