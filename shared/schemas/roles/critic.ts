import { z } from 'zod'

/**
 * Схема ответа Критика (pipeline step: critic_review).
 * Анализирует слабые места, стоп-факторы, даёт рекомендацию.
 */

export const WeaknessSchema = z.object({
  /** Описание слабого места */
  description: z.string(),
  /** Серьёзность (low/medium/high/critical) */
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  /** Как можно смягчить */
  mitigation: z.string().optional(),
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
  /** Слабые места (минимум 2) */
  weaknesses: z.array(WeaknessSchema).min(2).max(10),
  /** Стоп-факторы (если есть) */
  stopFactors: z.array(StopFactorSchema).max(5),
  /** Общая оценка (0–100) */
  overallScore: z.number().int().min(0).max(100),
  /** Рекомендация */
  recommendation: z.enum(['develop', 'validate_first', 'postpone', 'reject', 'insufficient_data']),
  /** Обоснование рекомендации */
  reasoning: z.string().min(20).max(500),
  /** Уверенность в оценке (low/medium/high) */
  confidence: z.enum(['low', 'medium', 'high']),
  /** Что нужно проверить перед решением */
  nextSteps: z.array(z.string()).min(1).max(5),
})

export type Weakness = z.infer<typeof WeaknessSchema>
export type StopFactor = z.infer<typeof StopFactorSchema>
export type CriticReview = z.infer<typeof CriticReviewSchema>
