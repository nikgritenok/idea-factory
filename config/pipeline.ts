// Конфиг пайплайна анализа (TZ §6: роли/этапы — в конфиге, отдельно от логики интерфейса).
// Этап 4: исполнители шагов — fixture (пометка FIXTURE, реальный прогон). Реальные
// LLM-роли подключаются в этапе 5 заменой executor в этом конфиге — без правок кода очереди.

export const PIPELINE_VERSION = 'v1-fixture'

export type ExecutorKind = 'fixture' | (string & {})

export type FunnelStage
  = | 'draft'
    | 'queued'
    | 'research'
    | 'critical_evaluation'
    | 'decision'
    | 'mvp_in_progress'
    | 'mvp_ready'
    | 'archived'

export interface PipelineStep {
  id: string
  role: string
  title: string
  executor: ExecutorKind
  timeoutMs: number
  retries: number
  /** Куда переводится funnel_stage идеи после успешного шага (TZ §3) */
  funnelStageAfter?: FunnelStage
}

export const PIPELINE_STEPS: readonly PipelineStep[] = [
  {
    id: 'orchestrator_plan',
    role: 'orchestrator',
    title: 'Оркестратор: план анализа',
    executor: 'fixture',
    timeoutMs: 30_000,
    retries: 1,
  },
  {
    id: 'idea_analysis',
    role: 'idea_analyst',
    title: 'Аналитик идеи: структура карточки',
    executor: 'fixture',
    timeoutMs: 60_000,
    retries: 1,
    funnelStageAfter: 'research',
  },
  {
    id: 'market_research',
    role: 'market_analyst',
    title: 'Аналитик рынка и аудитории',
    executor: 'fixture',
    timeoutMs: 60_000,
    retries: 1,
  },
  {
    id: 'strategy',
    role: 'strategist',
    title: 'Стратег-аналитик: сценарии и эксперименты',
    executor: 'fixture',
    timeoutMs: 60_000,
    retries: 1,
  },
  {
    id: 'efficiency_model',
    role: 'efficiency_analyst',
    title: 'Аналитик эффективности: мат./стат. модель',
    executor: 'fixture',
    timeoutMs: 60_000,
    retries: 1,
  },
  {
    id: 'critic_review',
    role: 'critic',
    title: 'Критик: слабые места, стоп-факторы',
    executor: 'fixture',
    timeoutMs: 60_000,
    retries: 1,
    funnelStageAfter: 'critical_evaluation',
  },
  {
    id: 'report_build',
    role: 'report_editor',
    title: 'Редактор отчёта: сборка версии отчёта',
    executor: 'fixture',
    timeoutMs: 30_000,
    retries: 1,
    funnelStageAfter: 'decision',
  },
] as const

export function getPipelineStep(stepId: string): PipelineStep | undefined {
  return PIPELINE_STEPS.find(s => s.id === stepId)
}

// Параметры очереди (TZ §8)
export const QUEUE_CONFIG = {
  /** Анти-голодание: low/medium ждёт дольше N минут → приоритет поднимается на шаг */
  antiStarvationMinutes: 15,
  /** Величина шага повышения приоритета (low→medium→high при base-шкале 10/20/30) */
  antiStarvationBump: 10,
  /** Базовый вес приоритета */
  priorityBase: { high: 30, medium: 20, low: 10 } as const,
  /** Интервал опроса очереди воркером, мс */
  pollIntervalMs: 2000,
} as const

export type QueuePriority = keyof typeof QUEUE_CONFIG.priorityBase
