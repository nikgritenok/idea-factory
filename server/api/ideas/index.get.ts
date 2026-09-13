import { useLogger } from 'evlog'

import { db } from '../../utils/db'
import { compareIdeasByPriority } from '~~/shared/priority'

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

  // Порядок — семантический (high → medium → low), а не алфавит БД:
  // priority текстовая колонка, orderBy(priority) навсегда кладёт medium под low.
  const rows = (await q.all()).sort(compareIdeasByPriority)

  log.set({ ideas: { count: rows.length } })

  return { ideas: rows }
})
