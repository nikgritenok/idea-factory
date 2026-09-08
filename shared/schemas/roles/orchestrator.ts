import { z } from 'zod'

/**
 * Схема ответа Оркестратора (pipeline step: orchestrator_plan).
 * Оркестратор анализирует входные данные и составляет план выполнения.
 */

export const OrchestratorPlanSchema = z.object({
  /** Краткое описание идеи (для заголовка карточки) */
  title: z.string().min(1).max(120),
  /** План анализа: какие шаги выполнить и в каком порядке */
  steps: z.array(z.string()).min(1).max(10),
  /** Приоритет идеи (high/medium/low) */
  priority: z.enum(['high', 'medium', 'low']),
  /** Ожидаемая сложность (low/medium/high) */
  complexity: z.enum(['low', 'medium', 'high']),
  /** Ориентировочное время выполнения (в минутах) */
  estimatedMinutes: z.number().positive().max(60),
  /** Примечания для следующих шагов */
  notes: z.string().optional(),
})

export type OrchestratorPlan = z.infer<typeof OrchestratorPlanSchema>
