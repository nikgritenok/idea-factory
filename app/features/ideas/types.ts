import type { FunnelStage, Priority } from '~~/shared/schemas'

export interface IdeaSummary {
  assumptions: null | Record<string, unknown>
  audience: null | string
  baselineMetrics: null | Record<string, unknown>
  constraints: null | Record<string, unknown>
  createdAt: string
  executionStatus: string
  expectedEffect: null | Record<string, unknown>
  funnelStage: FunnelStage
  id: string
  originalProcessDescription: null | string
  priority: Priority
  problem: null | string
  sourceKind: 'text' | 'voice'
  sourceTranscript: null | string
  structuredIdea: null | Record<string, unknown>
  title: string
  updatedAt: string
  value: null | string
  version: number
}

export interface JobSummary {
  attempts: number
  checkpoint: null | Record<string, unknown>
  currentStep: null | string
  effectivePriority?: number
  enqueuedAt: string
  error: null | string
  finishedAt: null | string
  id: string
  ideaId: string
  idempotencyKey?: null | string
  priority: Priority
  startedAt: null | string
  status: string
}

export interface ApiErrorShape {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/** Извлекает человекочитаемое сообщение из API-error envelope или сырой ошибки */
export function extractApiMessage(err: unknown): string {
  const maybe = err as { data?: ApiErrorShape, message?: string }
  return maybe.data?.error.message ?? maybe.message ?? 'Неизвестная ошибка'
}

export const FUNNEL_STAGES: readonly FunnelStage[] = [
  'draft', 'queued', 'research', 'critical_evaluation', 'decision', 'mvp_in_progress', 'mvp_ready', 'archived',
]

export const FUNNEL_LABELS: Record<string, string> = {
  archived: 'Архив',
  critical_evaluation: 'Критическая оценка',
  decision: 'Решение',
  draft: 'Черновик',
  mvp_in_progress: 'MVP в работе',
  mvp_ready: 'MVP готов',
  queued: 'В очереди',
  research: 'Исследование',
}

export const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий',
  low: 'Низкий',
  medium: 'Средний',
}

export const EXECUTION_LABELS: Record<string, string> = {
  error: 'Ошибка',
  paused: 'Пауза',
  running: 'Выполняется',
  waiting_for_data: 'Ожидание данных',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  cancelled: 'Отменено',
  done: 'Готово',
  failed: 'Ошибка',
  paused: 'Пауза',
  queued: 'В очереди',
  running: 'Выполняется',
}
