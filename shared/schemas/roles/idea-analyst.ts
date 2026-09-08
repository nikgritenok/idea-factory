import { z } from 'zod'

/**
 * Схема ответа Аналитика идеи (pipeline step: idea_analysis).
 * Структурирует исходную идею в карточку с полями.
 */

export const StructuredIdeaSchema = z.object({
  /** Название идеи (одна фраза) */
  title: z.string().min(1).max(120),
  /** Описание проблемы, которую решает идея */
  problem: z.string().min(10).max(500),
  /** Целевая аудитория */
  audience: z.string().min(5).max(300),
  /** Ключевая ценность / выгода */
  value: z.string().min(5).max(300),
  /** Ограничения (технические, ресурсные, временные) */
  constraints: z.array(z.string()).max(10),
  /** Допущения (на чём основана идея) */
  assumptions: z.array(z.string()).max(10),
  /** Ключевые метрики для измерения успеха */
  successMetrics: z.array(z.string()).max(5),
  /** Исходный текст идеи (без изменений) */
  sourceTranscript: z.string(),
})

export type StructuredIdea = z.infer<typeof StructuredIdeaSchema>
