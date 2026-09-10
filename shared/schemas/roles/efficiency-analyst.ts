import { z } from 'zod'

/**
 * Схема ответа Аналитика эффективности (pipeline step: efficiency_model).
 * Формулирует мат./стат. модель для расчёта потенциального эффекта.
 */

export const BaselineMetricsSchema = z.object({
  /** Текущее значение (базовый показатель) */
  currentValue: z.coerce.number(),
  /** Метрика (например, "время на обработку") */
  metric: z.string(),
  /** Доля пропусков (0–1) */
  missingRate: z.coerce.number().min(0).max(1),
  /** Количество наблюдений */
  observations: z.coerce.number().int().positive(),
  /** Период данных */
  period: z.string(),
  /** Источник данных */
  source: z.string(),
  /** Единица измерения */
  unit: z.string(),
})

export const EffectFormulaSchema = z.object({
  /** Ограничения применимости */
  assumptions: z.array(z.string()),
  /** Формула (строковое представление) */
  formula: z.string(),
  /** Название формулы */
  name: z.string(),
  /** Параметры формулы */
  parameters: z.array(z.object({
    defaultValue: z.coerce.number(),
    description: z.string(),
    name: z.string(),
    unit: z.string(),
  })),
  /** Единица результата */
  resultUnit: z.string(),
})

export const ScenarioEffectSchema = z.object({
  /** Доверительный интервал (если есть) */
  confidenceInterval: z.object({
    lower: z.coerce.number(),
    upper: z.coerce.number(),
  }).optional(),
  /** Описание сценария */
  description: z.string(),
  /** Ожидаемое изменение метрики */
  expectedChange: z.coerce.number(),
  /** Название сценария */
  name: z.string(),
  /** Процент изменения */
  percentChange: z.coerce.number(),
})

export const EfficiencyModelSchema = z.object({
  /** Базовые показатели исходного процесса */
  baselineMetrics: z.array(BaselineMetricsSchema).min(1).max(50),
  /** Уверенность в расчёте (low/medium/high) */
  confidence: z.enum(['low', 'medium', 'high']),
  /** Мат. модель эффекта */
  formula: EffectFormulaSchema,
  /** Примечания к расчёту */
  notes: z.string().optional(),
  /** Рекомендация на основе расчёта */
  recommendation: z.enum(['develop', 'validate_first', 'postpone', 'reject', 'insufficient_data']),
  /** 3 сценария (базовый/благоприятный/неблагоприятный) */
  scenarios: z.array(ScenarioEffectSchema).min(3).max(50),
  /** Порог полезного эффекта (минимальное улучшение) */
  threshold: z.coerce.number(),
})

export type BaselineMetrics = z.infer<typeof BaselineMetricsSchema>
export type EffectFormula = z.infer<typeof EffectFormulaSchema>
export type ScenarioEffect = z.infer<typeof ScenarioEffectSchema>
export type EfficiencyModel = z.infer<typeof EfficiencyModelSchema>
