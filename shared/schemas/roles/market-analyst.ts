import { z } from 'zod'

/**
 * Схема ответа Аналитика рынка и аудитории (pipeline step: market_research).
 * Анализирует рынок, конкурентов, сегменты аудитории.
 */

export const CompetitorSchema = z.object({
  name: z.string(),
  description: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  url: z.string().url().optional(),
})

export const PersonaSchema = z.object({
  name: z.string(),
  role: z.string(),
  painPoints: z.array(z.string()),
  goals: z.array(z.string()),
  objections: z.array(z.string()),
})

export const MarketSegmentSchema = z.object({
  name: z.string(),
  size: z.string(),
  characteristics: z.array(z.string()),
  willingnessToPay: z.enum(['low', 'medium', 'high']),
})

export const MarketAnalysisSchema = z.object({
  /** Общая оценка рынка (рыночная ниша) */
  marketSize: z.string(),
  /** Тренды рынка */
  trends: z.array(z.string()).min(2).max(5),
  /** Конкуренты/альтернативы (минимум 3) */
  competitors: z.array(CompetitorSchema).min(3).max(10),
  /** Прото-персоны (минимум 3) */
  personas: z.array(PersonaSchema).min(3).max(5),
  /** Сегменты аудитории */
  segments: z.array(MarketSegmentSchema).min(2).max(5),
  /** Ключевые выводы по рынку */
  insights: z.array(z.string()).min(2).max(5),
  /** Уровень уверенности в данных (low/medium/high) */
  confidence: z.enum(['low', 'medium', 'high']),
})

export type Competitor = z.infer<typeof CompetitorSchema>
export type Persona = z.infer<typeof PersonaSchema>
export type MarketSegment = z.infer<typeof MarketSegmentSchema>
export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>
