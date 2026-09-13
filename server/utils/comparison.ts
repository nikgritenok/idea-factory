import { db } from '../utils/db'

/**
 * Сравнение вариантов ИИ-решений (TZ §9).
 * Сравнивает 2 варианта на одном датасете.
 */

export interface ComparisonVariant {
  label: string
  runId: string
  variant: string
}

export interface ComparisonResult {
  confidence: 'high' | 'low' | 'medium'
  metrics: ComparisonMetrics
  variants: ComparisonVariant[]
  winner: null | string
}

export interface ComparisonMetrics {
  /** Среднее время выполнения (мс) */
  avgDurationMs: number
  /** Среднее количество токенов */
  avgTokens: number
  /** Количество ошибок */
  errorCount: number
  /** Доля успешных вызовов */
  successRate: number
  /** Общая стоимость (₽) */
  totalCost: number
}

/**
 * Сравнивает два прогона по метрикам из run_calls.
 */
export async function compareRuns(
  runId1: string,
  runId2: string,
): Promise<ComparisonResult> {
  const [metrics1, metrics2] = await Promise.all([
    getRunMetrics(runId1),
    getRunMetrics(runId2),
  ])

  const variant1: ComparisonVariant = {
    label: `Вариант 1 (${runId1.slice(0, 8)})`,
    runId: runId1,
    variant: 'variant_1',
  }

  const variant2: ComparisonVariant = {
    label: `Вариант 2 (${runId2.slice(0, 8)})`,
    runId: runId2,
    variant: 'variant_2',
  }

  // Определяем победителя по success rate и среднему времени
  let winner: null | string = null
  let confidence: 'high' | 'low' | 'medium' = 'low'

  if (metrics1.successRate > metrics2.successRate) {
    winner = variant1.variant
    confidence = metrics1.successRate - metrics2.successRate > 0.1 ? 'high' : 'medium'
  }
  else if (metrics2.successRate > metrics1.successRate) {
    winner = variant2.variant
    confidence = metrics2.successRate - metrics1.successRate > 0.1 ? 'high' : 'medium'
  }
  else if (metrics1.avgDurationMs < metrics2.avgDurationMs) {
    winner = variant1.variant
  }
  else if (metrics2.avgDurationMs < metrics1.avgDurationMs) {
    winner = variant2.variant
  }

  return {
    confidence,
    metrics: {
      avgDurationMs: (metrics1.avgDurationMs + metrics2.avgDurationMs) / 2,
      avgTokens: (metrics1.avgTokens + metrics2.avgTokens) / 2,
      errorCount: metrics1.errorCount + metrics2.errorCount,
      successRate: (metrics1.successRate + metrics2.successRate) / 2,
      totalCost: metrics1.totalCost + metrics2.totalCost,
    },
    variants: [variant1, variant2],
    winner,
  }
}

interface RunCallRow { durationMs: null | number, ok: boolean, response: unknown }

/**
 * Получает метрики одного прогона из run_calls.
 */
async function getRunMetrics(
  runId: string,
): Promise<ComparisonMetrics> {
  const calls = await db.orm.public.RunCalls
    .select('durationMs', 'ok', 'response')
    .where(f => f.runId.eq(runId))
    .all() as unknown as RunCallRow[]

  const totalCalls = calls.length
  const successfulCalls = calls.filter(c => c.ok).length
  const totalDuration = calls.reduce((sum, c) => sum + (c.durationMs ?? 0), 0)

  // Извлекаем токены из ответов LLM
  let totalTokens = 0
  for (const call of calls) {
    const response = call.response as { metadata?: { usage?: { totalTokens?: number } } } | null
    totalTokens += response?.metadata?.usage?.totalTokens ?? 0
  }

  return {
    avgDurationMs: totalCalls > 0 ? totalDuration / totalCalls : 0,
    avgTokens: totalCalls > 0 ? totalTokens / totalCalls : 0,
    errorCount: totalCalls - successfulCalls,
    successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
    totalCost: 0, // routerai.ru не всегда возвращает стоимость
  }
}

/**
 * Получает все прогоны для идеи.
 */
export async function getRunsForIdea(
  ideaId: string,
): Promise<Array<{ id: string, variant: string, status: string, startedAt: string }>> {
  const runs = await db.orm.public.Runs
    .select('id', 'variant', 'status', 'startedAt')
    .where(f => f.ideaId.eq(ideaId))
    .orderBy(f => f.startedAt.desc())
    .all()

  return runs.map(r => ({
    id: r.id,
    startedAt: r.startedAt,
    status: r.status,
    variant: r.variant,
  }))
}
