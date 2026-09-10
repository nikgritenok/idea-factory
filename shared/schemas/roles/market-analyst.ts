import { z } from 'zod'

/**
 * Схема ответа Аналитика рынка и аудитории (pipeline step: market_research).
 * Анализирует рынок, конкурентов, сегменты аудитории.
 */

export const CompetitorSchema = z.object({
  description: z.string(),
  name: z.string(),
  strengths: z.array(z.string()),
  url: z.string().url().optional(),
  weaknesses: z.array(z.string()),
})

export const PersonaSchema = z.object({
  goals: z.array(z.string()),
  name: z.string(),
  objections: z.array(z.string()),
  painPoints: z.array(z.string()),
  role: z.string(),
})

export const MarketSegmentSchema = z.object({
  characteristics: z.array(z.string()),
  name: z.string(),
  size: z.string(),
  willingnessToPay: z.enum(['low', 'medium', 'high']),
})

export const MarketAnalysisSchema = z.object({
  /** Конкуренты/альтернативы (минимум 3) */
  competitors: z.array(CompetitorSchema).min(3).max(50),
  /** Уровень уверенности в данных (low/medium/high) */
  confidence: z.enum(['low', 'medium', 'high']),
  /** Ключевые выводы по рынку */
  insights: z.array(z.string()).min(2).max(50),
  /** Общая оценка рынка (рыночная ниша) */
  marketSize: z.string(),
  /** Прото-персоны (минимум 3) */
  personas: z.array(PersonaSchema).min(3).max(50),
  /** Сегменты аудитории */
  segments: z.array(MarketSegmentSchema).min(2).max(50),
  /** Тренды рынка */
  trends: z.array(z.string()).min(2).max(50),
})

export type Competitor = z.infer<typeof CompetitorSchema>
export type Persona = z.infer<typeof PersonaSchema>
export type MarketSegment = z.infer<typeof MarketSegmentSchema>
export type MarketAnalysis = z.infer<typeof MarketAnalysisSchema>
