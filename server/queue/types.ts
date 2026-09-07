import type { Sql } from '../db/types'
import type { JobCheckpoint, JobRow, Priority } from '../utils/schemas'

import { JobCheckpointSchema, JobRowSchema, PrioritySchema } from '../utils/schemas'

export { JobCheckpointSchema, JobRowSchema, PrioritySchema }
export type { JobCheckpoint, JobRow, Priority }

export type QueuePriority = Priority

export interface StepContext {
  ideaId: string
  jobId: string
  signal: AbortSignal
  sql: Sql
  /** Результаты предыдущих шагов (state.stepResults) */
  state: Record<string, unknown>
  step: { id: string, role: string }
}

export interface StepResult {
  output: unknown
}

export type StepExecutor = (ctx: StepContext) => Promise<StepResult>
