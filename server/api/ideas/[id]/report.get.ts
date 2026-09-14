import { useLogger } from 'evlog'

import { db } from '~~/server/utils/db'
import { humanizeReportText } from '~~/server/utils/humanize-report'
import { parseUuid } from '~~/server/utils/schemas'

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

  if (!report) {
    return { report }
  }

  // Проза агентов выходит на экран через этот же ответ: сырые токены расчёта
  // (`rowCount`, `3.57 мин`) убираются здесь, а не в промптах и не в UI, чтобы
  // и страница, и любой другой потребитель видели одно и то же (ТЗ §4).
  // Обход общий (массивы и вложенные объекты) — ручной map() по секциям ломался
  // бы на любой другой форме jsonb.
  return {
    report: {
      ...report,
      sections: humanizeReportText(report.sections),
      stopFactors: humanizeReportText(report.stopFactors),
    },
  }
})
