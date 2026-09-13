import { createError, useLogger } from 'evlog'
import { z } from 'zod'

import { cancelJob } from '../../../queue/controls'
import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

const PatchSchema = z.object({
  funnel_stage: z.enum(['draft', 'queued', 'research', 'critical_evaluation', 'decision', 'mvp_in_progress', 'mvp_ready', 'archived']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
})

// PATCH /api/ideas/:id — архивирование / смена приоритета (владелец, TZ §11)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, PatchSchema.parse)

  log.set({ idea: { id: ideaId, requested: body } })

  const existing = await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .first()
  if (!existing) {
    throw createError({
      code: 'IDEA_NOT_FOUND',
      fix: 'Обновите список идей: запись могла быть удалена, пока была открыта карточка',
      message: 'Идея не найдена',
      status: 404,
      why: `Нечего обновлять — строки с id=${ideaId} в таблице Ideas нет`,
    })
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.funnel_stage) patch.funnelStage = body.funnel_stage
  if (body.priority) patch.priority = body.priority
  // В архиве прогон быть не может: без этого строка остаётся с execution_status='running',
  // и доска показывает «⏳ выполняется» у уже убранной идеи.
  if (body.funnel_stage === 'archived') patch.executionStatus = 'paused'

  await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .update(patch)

  // Архив, оставляющий задачу в очереди, — ловушка: прогон продолжает писать выводы
  // в убранную идею, а удалить её потом нельзя (DELETE отказывает живой задаче).
  // Отменяем cooperatively: worker остановится на границе шага.
  if (body.funnel_stage === 'archived') {
    const active = await db.orm.public.QueueJobs
      .select('id', 'status')
      .where(f => f.ideaId.eq(ideaId))
      .where(f => f.status.in(['queued', 'running']))
      .all()

    // Задачи независимы — отменяем параллельно (и без await в цикле).
    await Promise.all(active.map(async job => await cancelJob(db, job.id)))
    log.set({ queue: { cancelled: active.length } })
  }

  const updated = await db.orm.public.Ideas
    .where(f => f.id.eq(ideaId))
    .first()

  log.set({ idea: { changed: Object.keys(patch), funnelStage: updated?.funnelStage ?? null } })

  // Смена стадии воронки — то, что нельзя восстановить «просто так»: удаление каскадом
  // уносит историю, архив убирает идею из активных. Аудит обязателен (AGENTS.md).
  if (body.funnel_stage) {
    log.audit({
      action: body.funnel_stage === 'archived' ? 'idea.archived' : 'idea.stage_changed',
      actor: { id: 'owner', type: 'user' },
      changes: { after: body.funnel_stage, before: existing.funnelStage },
      outcome: 'success',
      target: { id: ideaId, type: 'idea' },
    })
  }

  return { idea: updated }
})
