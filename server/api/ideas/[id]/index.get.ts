import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/ideas/:id — карточка идеи с версиями и структурой
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  const idea = await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .first()

  if (!idea) {
    throw createError({ statusCode: 404, statusMessage: 'Idea not found' })
  }

  // Загружаем последнюю версию
  const versions = await db.orm.public.IdeaVersions
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.version.desc())
    .limit(5)
    .all()

  return { idea, versions }
})
