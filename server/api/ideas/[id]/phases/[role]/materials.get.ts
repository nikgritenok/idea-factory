import type { PhaseRole } from '~~/shared/phase-names'

import { createError, useLogger } from 'evlog'

import { db } from '~~/server/utils/db'
import { buildMaterials } from '~~/server/utils/materials'
import { parseUuid } from '~~/server/utils/schemas'
import { isPhaseRole, phaseTitle } from '~~/shared/phase-names'

/**
 * GET /api/ideas/:id/phases/:role/materials — MD-материалы одной фазы (TZ §4).
 *
 * Ключ — роль, а не id шага джобы: `agent_outputs` хранит выход именно по паре
 * (ideaId, role), а отдельной таблицы «шаги с полем output» в схеме нет. Роль ещё и
 * потому, что материал должен открываться и после того, как джоба уехала в архив.
 */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const ideaId = parseUuid(getRouterParam(event, 'id'))
  const rawRole = getRouterParam(event, 'role') ?? ''

  log.set({ idea: { id: ideaId }, phase: { role: rawRole } })

  if (!isPhaseRole(rawRole)) {
    throw createError({
      code: 'PHASE_UNKNOWN',
      fix: 'Откройте «Ход работы» в карточке идеи и выберите фазу оттуда — ссылка на материал не набирается вручную',
      message: 'Неизвестная фаза',
      status: 400,
      why: `Фазы с ролью «${rawRole}» в пайплайне нет`,
    })
  }

  const role: PhaseRole = rawRole
  const phase = phaseTitle(role, 'Этап работы')

  const idea = await db.orm.public.Ideas
    .select('id')
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

  const row = await db.orm.public.AgentOutputs
    .where(f => f.ideaId.eq(ideaId))
    .where(f => f.role.eq(role))
    .where(f => f.outdated.eq(false))
    .orderBy(f => f.createdAt.desc())
    .limit(1)
    .first()

  if (!row) {
    throw createError({
      code: 'PHASE_NOT_FINISHED',
      fix: 'Дождитесь, пока прогон дойдёт до этой фазы, или запустите анализ заново из карточки идеи',
      message: 'Материалов фазы пока нет',
      status: 404,
      why: `Фаза «${phase}» ещё не завершилась для этой идеи: в agent_outputs нет актуальной записи с role=${role}`,
    })
  }

  const { blocks, markdown } = buildMaterials({
    finishedAt: row.createdAt,
    role,
    value: row.output,
  })

  log.set({ doc: { blocks: blocks.length, chars: markdown.length } })

  return {
    blocks,
    generatedAt: new Date().toISOString(),
    markdown,
    phase: { role, title: phase },
    source: { createdAt: row.createdAt, runId: row.runId ?? null },
  }
})
