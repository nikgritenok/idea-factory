import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  const rows = await db.orm.public.Ideas
    .where(f => f.funnelStage.neq('archived'))
    .select(
      'id', 'title', 'sourceTranscript', 'sourceKind',
      'structuredIdea', 'problem', 'audience', 'value',
      'constraints', 'assumptions', 'priority', 'funnelStage',
      'executionStatus', 'originalProcessDescription',
      'baselineMetrics', 'expectedEffect',
      'createdAt', 'updatedAt', 'version',
    )
    .orderBy(f => f.priority.asc())
    .orderBy(f => f.createdAt.desc())
    .all()
  return { ideas: rows }
})
