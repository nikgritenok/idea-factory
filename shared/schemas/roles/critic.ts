import { z } from 'zod'

/**
 * Схема ответа Критика (pipeline step: critic_review).
 * Анализирует слабые места, стоп-факторы, даёт рекомендацию.
 */

export const WeaknessSchema = z.object({
  /** Описание слабого места */
  description: z.string(),
  /** Как можно смягчить */
  mitigation: z.string().optional(),
  /** Серьёзность (low/medium/high/critical) */
  severity: z.enum(['low', 'medium', 'high', 'critical']),
})

export const StopFactorSchema = z.object({
  /** Описание стоп-фактора */
  description: z.string(),
  /** Почему это стоп-фактор */
  reason: z.string(),
  /** Есть ли обходной путь */
  workaround: z.string().optional(),
})

export const CriticReviewSchema = z.object({
  /** Уверенность в оценке (low/medium/high) */
  confidence: z.enum(['low', 'medium', 'high']),
  /** Что нужно проверить перед решением */
  nextSteps: z.array(z.string()).min(1).max(50),
  /** Общая оценка (0–100) */
  overallScore: z.coerce.number().int().min(0).max(100),
  /** Обоснование рекомендации */
  reasoning: z.string().min(20).max(2000),
  /** Рекомендация */
  recommendation: z.enum(['develop', 'validate_first', 'postpone', 'reject', 'insufficient_data']),
  /** Стоп-факторы (если есть) */
  stopFactors: z.array(StopFactorSchema).max(50),
  /** Слабые места (минимум 2) */
  weaknesses: z.array(WeaknessSchema).min(2).max(50),
})

export type Weakness = z.infer<typeof WeaknessSchema>
export type StopFactor = z.infer<typeof StopFactorSchema>
export type CriticReview = z.infer<typeof CriticReviewSchema>
