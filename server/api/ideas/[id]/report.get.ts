import { useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id/report — последняя версия отчёта (экран «Отчёт», TZ §7a)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const report = await db.orm.public.Reports
    .where(f => f.ideaId.eq(ideaId))
    .where(f => f.outdated.eq(false))
    .orderBy(f => f.version.desc())
    .first()

  log.set({ report: { found: Boolean(report), version: report?.version ?? null } })

  return { report }
})
