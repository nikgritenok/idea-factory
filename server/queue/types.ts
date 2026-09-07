import type { Sql } from '../db/migrate'
import { JobCheckpointSchema, JobRowSchema, PrioritySchema } from '../utils/schemas'
import type { JobCheckpoint, JobRow, Priority } from '../utils/schemas'

export { JobCheckpointSchema, JobRowSchema, PrioritySchema }
export type { JobCheckpoint, JobRow, Priority }

export type QueuePriority = Priority

export interface StepContext {
  sql: Sql
  ideaId: string
  jobId: string
  step: { id: string }
  /** Результаты предыдущих шагов (state.stepResults) */
  state: Record<string, unknown>
  signal: AbortSignal
}

export interface StepResult {
  output: unknown
}

export type StepExecutor = (ctx: StepContext) => Promise<StepResult>
