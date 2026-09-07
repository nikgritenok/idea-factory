import type { PipelineStep, QueuePriority } from '../../config/pipeline'
import type { Sql } from '../db/migrate'

export { type PipelineStep, type QueuePriority } from '../../config/pipeline'

/** Строка queue_jobs (TZ §8) */
export interface JobRow {
  id: string
  idea_id: string
  priority: QueuePriority
  effective_priority: number
  status: 'queued' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed'
  attempts: number
  current_step: string | null
  checkpoint: JobCheckpoint | null
  idempotency_key: string | null
  enqueued_at: Date
  started_at: Date | null
  finished_at: Date | null
  error: string | null
}

/** Ссылка на состояние графа LangGraph + флаги, живёт в queue_jobs.checkpoint (jsonb) */
export interface JobCheckpoint {
  thread_id: string
  graph_started: boolean
  last_step: string | null
  /** Повтор шага (TZ §8): откатиться к checkpoint перед этим шагом */
  rewind_to_step: string | null
}

export interface StepContext {
  sql: Sql
  ideaId: string
  jobId: string
  step: PipelineStep
  /** Результаты предыдущих шагов (state.stepResults) */
  state: Record<string, unknown>
  signal: AbortSignal
}

export interface StepResult {
  output: unknown
}

export type StepExecutor = (ctx: StepContext) => Promise<StepResult>
