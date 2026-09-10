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
      title,
      sourceTranscript: parsed.transcript,
      sourceKind: parsed.source_kind,
      priority: parsed.priority,
      funnelStage: 'draft',
      executionStatus: 'paused',
    })

  await db.orm.public.IdeaVersions.create({
    ideaId: idea.id,
    version: 1,
    snapshot: idea,
    changedFields: { created: true },
  })

  setResponseStatus(event, 201)
  return { idea }
})
