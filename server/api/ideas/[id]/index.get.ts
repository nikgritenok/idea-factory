import { createError, useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id — карточка идеи с версиями и структурой
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const idea = await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .first()

  if (!idea) {
    throw createError({
      code: 'IDEA_NOT_FOUND',
      fix: 'Вернитесь на доску и откройте существующую идею — ссылка могла устареть',
      message: 'Идея не найдена',
      status: 404,
      why: `В таблице Ideas нет записи с id=${ideaId}`,
    })
  }

  // Загружаем последнюю версию
  const versions = await db.orm.public.IdeaVersions
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.version.desc())
    .limit(5)
    .all()

  log.set({ idea: { funnelStage: idea.funnelStage, versions: versions.length } })

  return { idea, versions }
})
