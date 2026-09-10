import { z } from 'zod'

/**
 * Схема ответа Стратега-аналитика (pipeline step: strategy).
 * Формулирует стратегические сценарии и приоритет эксперимента.
 */

export const ScenarioSchema = z.object({
  description: z.string(),
  /** Ожидаемый эффект (описание) */
  effect: z.string(),
  /** Ключевые факторы успеха/провала */
  keyFactors: z.array(z.string()).min(1).max(5),
  name: z.string(),
  /** Вероятность наступления (0–1) */
  probability: z.number().min(0).max(1),
  /** Благоприятный / базовый / неблагоприятный */
  type: z.enum(['optimistic', 'base', 'pessimistic']),
})

export const ExperimentSchema = z.object({
  /** Время на эксперимент */
  duration: z.string(),
  /** Что проверяем */
  hypothesis: z.string(),
  /** Как проверяем */
  method: z.string(),
  /** Какая метрика */
  metric: z.string(),
  /** Ресурсы */
  resources: z.string(),
  /** Порог успеха */
  successThreshold: z.string(),
})

export const StrategySchema = z.object({
  /** Приоритет эксперимента (что проверять первым) */
  experimentPriority: z.number().int().positive(),
  /** Проверяемые гипотезы (минимум 3) */
  experiments: z.array(ExperimentSchema).min(3).max(5),
  /** Стратегические рекомендации */
  recommendations: z.array(z.string()).min(2).max(5),
  /** Рекомендуемый сценарий */
  recommendedScenario: z.string(),
  /** Риски, которые могут повлиять на стратегию */
  risks: z.array(z.string()).min(1).max(5),
  /** Варианты развития (минимум 2) */
  scenarios: z.array(ScenarioSchema).min(2).max(5),
})

export type Scenario = z.infer<typeof ScenarioSchema>
export type Experiment = z.infer<typeof ExperimentSchema>
export type Strategy = z.infer<typeof StrategySchema>
