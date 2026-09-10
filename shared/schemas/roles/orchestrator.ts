import { z } from 'zod'

/**
 * Схема ответа Оркестратора (pipeline step: orchestrator_plan).
 * Оркестратор анализирует входные данные и составляет план выполнения.
 *
 * Толерантность к формату LLM: модель может вернуть estimatedMinutes строкой
 * ("30 минут"), а steps — массивом объектов {title|name|step}. Препроцессинг
 * нормализует оба случая до строгой формы.
 */

const MinutesSchema = z.preprocess((v) => {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const m = v.match(/\d+/)
    if (m) return Number(m[0])
  }
  if (typeof v === 'object' && v !== null) {
    const rec = v as Record<string, unknown>
    for (const key of ['minutes', 'estimatedMinutes', 'value', 'time']) {
      if (typeof rec[key] === 'number') return rec[key]
    }
  }
  return v
}, z.coerce.number().positive().max(600).catch(30))

const StepItemSchema = z.preprocess((v) => {
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null) {
    const rec = v as Record<string, unknown>
    for (const key of ['title', 'name', 'step', 'description', 'action']) {
      if (typeof rec[key] === 'string') return rec[key]
    }
  }
  if (v === null || v === undefined) return ''
  return String(v)
}, z.string().min(1).max(2000).catch('шаг анализа'))

export const OrchestratorPlanSchema = z.object({
  /** Ожидаемая сложность (low/medium/high) */
  complexity: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v
      const lower = v.toLowerCase().trim()
      // Маппинг русских значений
      if (['низкая', 'низкий', 'простая', 'простой'].includes(lower)) return 'low'
      if (['средняя', 'средний', 'средне'].includes(lower)) return 'medium'
      if (['высокая', 'высокий', 'сложная', 'сложный'].includes(lower)) return 'high'
      return lower
    },
    z.enum(['low', 'medium', 'high']).catch('medium'),
  ),
  /** Ориентировочное время выполнения (в минутах) */
  estimatedMinutes: MinutesSchema,
  /** Примечания для следующих шагов */
  notes: z.preprocess(
    (v) => (v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)),
    z.string().max(2000).optional(),
  ),
  /** Приоритет идеи (high/medium/low) */
  priority: z.preprocess(
    (v) => {
      if (typeof v !== 'string') return v
      const lower = v.toLowerCase().trim()
      if (['низкий', 'низкая'].includes(lower)) return 'low'
      if (['средний', 'средняя'].includes(lower)) return 'medium'
      if (['высокий', 'высокая'].includes(lower)) return 'high'
      return lower
    },
    z.enum(['high', 'medium', 'low']).catch('medium'),
  ),
  /** План анализа: какие шаги выполнить и в каком порядке */
  steps: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v
      if (v == null) return ['анализ идеи']
      return [String(v)]
    },
    z.array(StepItemSchema).min(1).max(50).catch(['анализ идеи']),
  ),
  /** Краткое описание идеи (для заголовка карточки) */
  title: z.preprocess(
    (v) => (typeof v === 'string' && v.length > 0 ? v : String(v ?? 'Анализ идеи')),
    z.string().min(1).max(2000),
  ),
})

export type OrchestratorPlan = z.infer<typeof OrchestratorPlanSchema>
