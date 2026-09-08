import { z } from 'zod'

/**
 * Схема ответа Аналитика эффективности (pipeline step: efficiency_model).
 * Формулирует мат./стат. модель для расчёта потенциального эффекта.
 */

export const BaselineMetricsSchema = z.object({
  /** Метрика (например, "время на обработку") */
  metric: z.string(),
  /** Текущее значение (базовый показатель) */
  currentValue: z.number(),
  /** Единица измерения */
  unit: z.string(),
  /** Источник данных */
  source: z.string(),
  /** Период данных */
  period: z.string(),
  /** Количество наблюдений */
  observations: z.number().int().positive(),
  /** Доля пропусков (0–1) */
  missingRate: z.number().min(0).max(1),
})

export const EffectFormulaSchema = z.object({
  /** Название формулы */
  name: z.string(),
  /** Формула (строковое представление) */
  formula: z.string(),
  /** Параметры формулы */
  parameters: z.array(z.object({
    name: z.string(),
    description: z.string(),
    unit: z.string(),
    defaultValue: z.number(),
  })),
  /** Единица результата */
  resultUnit: z.string(),
  /** Ограничения применимости */
  assumptions: z.array(z.string()),
})

export const ScenarioEffectSchema = z.object({
  /** Название сценария */
  name: z.string(),
  /** Описание сценария */
  description: z.string(),
  /** Ожидаемое изменение метрики */
  expectedChange: z.number(),
  /** Процент изменения */
  percentChange: z.number(),
  /** Доверительный интервал (если есть) */
  confidenceInterval: z.object({
    lower: z.number(),
    upper: z.number(),
  }).optional(),
})

export const EfficiencyModelSchema = z.object({
  /** Базовые показатели исходного процесса */
  baselineMetrics: z.array(BaselineMetricsSchema).min(1).max(5),
  /** Мат. модель эффекта */
  formula: EffectFormulaSchema,
  /** 3 сценария (базовый/благоприятный/неблагоприятный) */
  scenarios: z.array(ScenarioEffectSchema).min(3).max(3),
  /** Порог полезного эффекта (минимальное улучшение) */
  threshold: z.number(),
  /** Рекомендация на основе расчёта */
  recommendation: z.enum(['develop', 'validate_first', 'postpone', 'reject', 'insufficient_data']),
  /** Уверенность в расчёте (low/medium/high) */
  confidence: z.enum(['low', 'medium', 'high']),
  /** Примечания к расчёту */
  notes: z.string().optional(),
})

export type BaselineMetrics = z.infer<typeof BaselineMetricsSchema>
export type EffectFormula = z.infer<typeof EffectFormulaSchema>
export type ScenarioEffect = z.infer<typeof ScenarioEffectSchema>
export type EfficiencyModel = z.infer<typeof EfficiencyModelSchema>
