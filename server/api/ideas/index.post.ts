import { db } from '../../utils/db'
import { countActiveIdeas, titleFromTranscript } from '../../utils/ideas'
import { IDEA_LIMIT_ACTIVE, IdeaCreateSchema } from '../../utils/schemas'

export default defineEventHandler(async (event) => {
  const body = await readBody(event) as unknown
  const parsed = IdeaCreateSchema.parse(body)

  const activeCount = await countActiveIdeas()
  if (activeCount >= IDEA_LIMIT_ACTIVE) {
    throw createError({
      statusCode: 409,
      statusMessage: `Достигнут лимит ${IDEA_LIMIT_ACTIVE} активных идей. Заархивируйте что-нибудь`,
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

  setResponseStatus(event, 201)
  return { idea }
})
