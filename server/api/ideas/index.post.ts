import { createError, useLogger } from 'evlog'

import { db } from '../../utils/db'
import { countActiveIdeas, titleFromTranscript } from '../../utils/ideas'
import { IDEA_LIMIT_ACTIVE, IdeaCreateSchema } from '../../utils/schemas'

// POST /api/ideas — создать идею из текста (TZ §5, лимит активных — §8)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const body = await readBody(event) as unknown
  const parsed = IdeaCreateSchema.parse(body)

  // Transcript в событие не кладём: это пользовательский текст, в логах ему не место.
  log.set({ idea: { priority: parsed.priority, sourceKind: parsed.source_kind, transcriptLength: parsed.transcript.length } })

  const activeCount = await countActiveIdeas()
  if (activeCount >= IDEA_LIMIT_ACTIVE) {
    throw createError({
      code: 'IDEA_LIMIT_REACHED',
      data: { activeCount, limit: IDEA_LIMIT_ACTIVE },
      fix: 'Заархивируйте завершённую идею на доске и повторите создание',
      message: `Достигнут лимит ${IDEA_LIMIT_ACTIVE} активных идей`,
      status: 409,
      why: `Сейчас активных идей ${activeCount}, порог по TZ §8 — ${IDEA_LIMIT_ACTIVE}`,
    })
  }

  const title = titleFromTranscript(parsed.transcript)

  const idea = await db.orm.public.Ideas
    .select(
      'id', 'title', 'sourceTranscript', 'sourceKind',
      'structuredIdea', 'problem', 'audience', 'value',
      'constraints', 'assumptions', 'priority', 'funnelStage',
      'executionStatus', 'originalProcessDescription',
      'baselineMetrics', 'expectedEffect',
      'createdAt', 'updatedAt', 'version',
    )
    .create({
      executionStatus: 'paused',
      funnelStage: 'draft',
      priority: parsed.priority,
      sourceKind: parsed.source_kind,
      sourceTranscript: parsed.transcript,
      title,
    })

  await db.orm.public.IdeaVersions.create({
    changedFields: { created: true },
    ideaId: idea.id,
    snapshot: idea,
    version: 1,
  })

  log.set({ idea: { id: idea.id, version: 1 } })

  setResponseStatus(event, 201)
  return { idea }
})
