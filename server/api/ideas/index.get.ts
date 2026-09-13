import { useLogger } from 'evlog'

import { db } from '../../utils/db'

// GET /api/ideas — список идей, опционально фильтром по стадии воронки (?stage=)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  const query = getQuery(event)
  const stage = query.stage as string | undefined

  log.set({ filter: { stage: stage ?? '!=archived' } })

  let q = db.orm.public.Ideas
    .select(
      'id', 'title', 'sourceTranscript', 'sourceKind',
      'structuredIdea', 'problem', 'audience', 'value',
      'constraints', 'assumptions', 'priority', 'funnelStage',
      'executionStatus', 'originalProcessDescription',
      'baselineMetrics', 'expectedEffect',
      'createdAt', 'updatedAt', 'version',
    )

  q = stage ? q.where(f => f.funnelStage.eq(stage)) : q.where(f => f.funnelStage.neq('archived'))

  const rows = await q
    .orderBy(f => f.priority.asc())
    .orderBy(f => f.createdAt.desc())
    .all()

  log.set({ ideas: { count: rows.length } })

  return { ideas: rows }
})
