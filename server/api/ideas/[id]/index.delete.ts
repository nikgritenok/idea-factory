import { createError, useLogger } from 'evlog'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

const LIVE_JOB_STATUSES = new Set(['queued', 'running'])

// DELETE /api/ideas/:id — полное удаление идеи (владелец, TZ §11).
// Не путать с архивом: архив обратим и остаётся в «Архив (N)», удаление стирает строку.
// Каскады в контракте (idea_versions, queue_jobs, runs→run_calls, reports, sources,
// calculations, agent_outputs, audio_files — все onDelete: Cascade) уносят за идеей всю
// историю, поэтому путь доступен только для уже архивированной идеи: так исключается
// случай «удалил идею, у которой прямо сейчас идёт прогон».
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))

  log.set({ idea: { id: ideaId } })

  const idea = await db.orm.public.Ideas
    .select('id', 'title', 'funnelStage')
    .where(f => f.id.eq(ideaId))
    .first()

  if (!idea) {
    throw createError({
      code: 'IDEA_NOT_FOUND',
      fix: 'Обновите список идей — возможно, её уже удалили',
      message: 'Идея не найдена',
      status: 404,
      why: `Строки с id=${ideaId} в таблице Ideas нет`,
    })
  }

  const liveJob = await db.orm.public.QueueJobs
    .select('id', 'status')
    .where(f => f.ideaId.eq(ideaId))
    .first()

  if (liveJob && LIVE_JOB_STATUSES.has(liveJob.status)) {
    throw createError({
      code: 'IDEA_JOB_ACTIVE',
      fix: 'Сначала остановите прогон на карточке идеи, затем удалите',
      message: 'Идея сейчас в очереди или в работе',
      status: 409,
      why: `Для id=${ideaId} есть задача ${liveJob.id} в статусе «${liveJob.status}»`,
    })
  }

  if (idea.funnelStage !== 'archived') {
    throw createError({
      code: 'IDEA_NOT_ARCHIVED',
      fix: 'Сначала отправьте идею в архив — удаление доступно только для архивированных',
      message: 'Удалить можно только идею из архива',
      status: 409,
      why: `funnel_stage = «${idea.funnelStage}», удаление разрешено только для «archived»`,
    })
  }

  await db.orm.public.Ideas.where(f => f.id.eq(ideaId)).delete()

  log.set({ idea: { deleted: true, title: idea.title } })
  log.audit({
    action: 'idea.deleted',
    actor: { id: 'owner', type: 'user' },
    outcome: 'success',
    target: { id: ideaId, type: 'idea' },
  })

  setResponseStatus(event, 204)
})
