// Конфиг пайплайна анализа (TZ §6: роли/этапы — в конфиге, отдельно от логики интерфейса).
// Этап 5: LLM-роли подключены (executor: 'llm'). Редактор отчёта остаётся fixture
// (детерминированная сборка, не LLM).

import type { FunnelStage, PipelineStep } from '../server/utils/schemas'

import { FunnelStageSchema, PipelineStepSchema } from '../server/utils/schemas'

export { FunnelStageSchema, PipelineStepSchema }
export type { FunnelStage, PipelineStep }

export const PIPELINE_VERSION = 'v1-llm'

export type ExecutorKind = 'fixture' | 'llm' | (string & {})

export const PIPELINE_STEPS: readonly PipelineStep[] = [
  {
    executor: 'llm',
    id: 'orchestrator_plan',
    retries: 1,
    role: 'orchestrator',
    timeoutMs: 60_000,
    title: 'Оркестратор: план анализа',
  },
  {
    executor: 'llm',
    funnelStageAfter: 'research',
    id: 'idea_analysis',
    retries: 1,
    role: 'idea_analyst',
    timeoutMs: 60_000,
    title: 'Аналитик идеи: структура карточки',
  },
  {
    executor: 'llm',
    id: 'market_research',
    retries: 1,
    role: 'market_analyst',
    timeoutMs: 90_000,
    title: 'Аналитик рынка и аудитории',
  },
  {
    executor: 'llm',
    id: 'strategy',
    retries: 1,
    role: 'strategist',
    timeoutMs: 90_000,
    title: 'Стратег-аналитик: сценарии и эксперименты',
  },
  {
    executor: 'llm',
    id: 'efficiency_model',
    retries: 1,
    role: 'efficiency_analyst',
    timeoutMs: 90_000,
    title: 'Аналитик эффективности: мат./стат. модель',
  },
  {
    executor: 'llm',
    funnelStageAfter: 'critical_evaluation',
    id: 'critic_review',
    retries: 1,
    role: 'critic',
    timeoutMs: 60_000,
    title: 'Критик: слабые места, стоп-факторы',
  },
  {
    executor: 'fixture',
    funnelStageAfter: 'decision',
    id: 'report_build',
    retries: 1,
    role: 'report_editor',
    timeoutMs: 30_000,
    title: 'Редактор отчёта: сборка версии отчёта',
  },
] as const

export function getPipelineStep(stepId: string): PipelineStep | undefined {
  return PIPELINE_STEPS.find(s => s.id === stepId)
}

// Параметры очереди (TZ §8)
export const QUEUE_CONFIG = {
  /** Величина шага повышения приоритета (low→medium→high при base-шкале 10/20/30) */
  antiStarvationBump: 10,
  /** Анти-голодание: low/medium ждёт дольше N минут → приоритет поднимается на шаг */
  antiStarvationMinutes: 15,
  /** Интервал опроса очереди воркером, мс */
  pollIntervalMs: 2000,
  /** Базовый вес приоритета */
  priorityBase: { high: 30, low: 10, medium: 20 } as const,
} as const

export type QueuePriority = keyof typeof QUEUE_CONFIG.priorityBase
