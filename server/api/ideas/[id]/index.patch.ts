import { z } from 'zod'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

const PatchSchema = z.object({
  funnel_stage: z.enum(['draft', 'queued', 'research', 'critical_evaluation', 'decision', 'mvp_in_progress', 'mvp_ready', 'archived']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
})

// PATCH /api/ideas/:id — архивирование / смена приоритета (владелец, TZ §11)
export default defineEventHandler(async (event) => {
  const ideaId = parseUuid(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, PatchSchema.parse)

  const existing = await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .first()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Идея не найдена' })
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.funnel_stage) patch.funnelStage = body.funnel_stage
  if (body.priority) patch.priority = body.priority

  await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .update(patch)

  const updated = await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .first()

  return { idea: updated }
})
