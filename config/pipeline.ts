// Конфиг пайплайна анализа (TZ §6: роли/этапы — в конфиге, отдельно от логики интерфейса).
// Этап 4: исполнители шагов — fixture (пометка FIXTURE, реальный прогон). Реальные
// LLM-роли подключаются в этапе 5 заменой executor в этом конфиге — без правок кода очереди.

import type { FunnelStage, PipelineStep } from '../server/utils/schemas'

import { FunnelStageSchema, PipelineStepSchema } from '../server/utils/schemas'

export { FunnelStageSchema, PipelineStepSchema }
export type { FunnelStage, PipelineStep }

export const PIPELINE_VERSION = 'v1-fixture'

export type ExecutorKind = 'fixture' | (string & {})

export const PIPELINE_STEPS: readonly PipelineStep[] = [
  {
    executor: 'fixture',
    id: 'orchestrator_plan',
    retries: 1,
    role: 'orchestrator',
    timeoutMs: 30_000,
    title: 'Оркестратор: план анализа',
  },
  {
    executor: 'fixture',
    funnelStageAfter: 'research',
    id: 'idea_analysis',
    retries: 1,
    role: 'idea_analyst',
    timeoutMs: 60_000,
    title: 'Аналитик идеи: структура карточки',
  },
  {
    executor: 'fixture',
    id: 'market_research',
    retries: 1,
    role: 'market_analyst',
    timeoutMs: 60_000,
    title: 'Аналитик рынка и аудитории',
  },
  {
    executor: 'fixture',
    id: 'strategy',
    retries: 1,
    role: 'strategist',
    timeoutMs: 60_000,
    title: 'Стратег-аналитик: сценарии и эксперименты',
  },
  {
    executor: 'fixture',
    id: 'efficiency_model',
    retries: 1,
    role: 'efficiency_analyst',
    timeoutMs: 60_000,
    title: 'Аналитик эффективности: мат./стат. модель',
  },
  {
    executor: 'fixture',
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
