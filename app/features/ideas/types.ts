import type { FunnelStage, Priority } from '~~/shared/schemas'

import { parseError } from 'evlog'

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

/**
 * Извлекает человекочитаемое сообщение из ошибки API.
 *
 * Читает ответ evlog (`{ status, message, data: { code, why, fix } }`) через parseError —
 * он же покрывает и старый вид h3-ответа (`statusMessage`), и случай, когда $fetch уже
 * развернул тело в `err.data`. Раньше функция смотрела только в `data.error.message`,
 * чего в ответах не было, и всегда возвращала заглушку из `err.message`.
 */
export function extractApiMessage(err: unknown, fallback = 'Неизвестная ошибка'): string {
  // parseError на null/undefined даёт строку "undefined" — её показывать нельзя
  if (err === null || err === undefined) {
    return fallback
  }

  return parseError(err).message || fallback
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
