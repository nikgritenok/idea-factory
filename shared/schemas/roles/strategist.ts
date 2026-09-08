import { z } from 'zod'

/**
 * Схема ответа Стратега-аналитика (pipeline step: strategy).
 * Формулирует стратегические сценарии и приоритет эксперимента.
 */

export const ScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  /** Благоприятный / базовый / неблагоприятный */
  type: z.enum(['optimistic', 'base', 'pessimistic']),
  /** Вероятность наступления (0–1) */
  probability: z.number().min(0).max(1),
  /** Ожидаемый эффект (описание) */
  effect: z.string(),
  /** Ключевые факторы успеха/провала */
  keyFactors: z.array(z.string()).min(1).max(5),
})

export const ExperimentSchema = z.object({
  /** Что проверяем */
  hypothesis: z.string(),
  /** Как проверяем */
  method: z.string(),
  /** Какая метрика */
  metric: z.string(),
  /** Порог успеха */
  successThreshold: z.string(),
  /** Время на эксперимент */
  duration: z.string(),
  /** Ресурсы */
  resources: z.string(),
})

export const StrategySchema = z.object({
  /** Варианты развития (минимум 2) */
  scenarios: z.array(ScenarioSchema).min(2).max(5),
  /** Рекомендуемый сценарий */
  recommendedScenario: z.string(),
  /** Проверяемые гипотезы (минимум 3) */
  experiments: z.array(ExperimentSchema).min(3).max(5),
  /** Приоритет эксперимента (что проверять первым) */
  experimentPriority: z.number().int().positive(),
  /** Стратегические рекомендации */
  recommendations: z.array(z.string()).min(2).max(5),
  /** Риски, которые могут повлиять на стратегию */
  risks: z.array(z.string()).min(1).max(5),
})

export type Scenario = z.infer<typeof ScenarioSchema>
export type Experiment = z.infer<typeof ExperimentSchema>
export type Strategy = z.infer<typeof StrategySchema>
