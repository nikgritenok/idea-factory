import { db } from '../utils/db'

/**
 * Сравнение вариантов ИИ-решений (TZ §9).
 * Сравнивает 2 варианта на одном датасете.
 */

export interface ComparisonVariant {
  runId: string
  variant: string
  label: string
}

export interface ComparisonResult {
  variants: ComparisonVariant[]
  metrics: ComparisonMetrics
  winner: string | null
  confidence: 'low' | 'medium' | 'high'
}

export interface ComparisonMetrics {
  /** Среднее время выполнения (мс) */
  avgDurationMs: number
  /** Общая стоимость (₽) */
  totalCost: number
  /** Доля успешных вызовов */
  successRate: number
  /** Количество ошибок */
  errorCount: number
  /** Среднее количество токенов */
  avgTokens: number
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
    runId: runId1,
    variant: 'variant_1',
    label: `Вариант 1 (${runId1.slice(0, 8)})`,
  }

  const variant2: ComparisonVariant = {
    runId: runId2,
    variant: 'variant_2',
    label: `Вариант 2 (${runId2.slice(0, 8)})`,
  }

  // Определяем победителя по success rate и среднему времени
  let winner: string | null = null
  let confidence: 'low' | 'medium' | 'high' = 'low'

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
    confidence = 'low'
  }
  else if (metrics2.avgDurationMs < metrics1.avgDurationMs) {
    winner = variant2.variant
    confidence = 'low'
  }

  return {
    metrics: {
      avgDurationMs: (metrics1.avgDurationMs + metrics2.avgDurationMs) / 2,
      totalCost: metrics1.totalCost + metrics2.totalCost,
      successRate: (metrics1.successRate + metrics2.successRate) / 2,
      errorCount: metrics1.errorCount + metrics2.errorCount,
      avgTokens: (metrics1.avgTokens + metrics2.avgTokens) / 2,
    },
    variants: [variant1, variant2],
    winner,
    confidence,
  }
}

interface RunCallRow { durationMs: number | null, ok: boolean, response: unknown }

/**
 * Получает метрики одного прогона из run_calls.
 */
async function getRunMetrics(
  runId: string,
): Promise<ComparisonMetrics> {
  const calls = await db.orm.public.RunCalls
    .select('durationMs', 'ok', 'response')
    .where((f) => f.runId.eq(runId))
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
    totalCost: 0, // routerai.ru не всегда возвращает стоимость
    errorCount: totalCalls - successfulCalls,
    successRate: totalCalls > 0 ? successfulCalls / totalCalls : 0,
    avgTokens: totalCalls > 0 ? totalTokens / totalCalls : 0,
  }
}

/**
 * Получает все прогоны для идеи.
 */
export async function getRunsForIdea(
  ideaId: string,
): Promise<Array<{ id: string, variant: string, status: string, startedAt: Date }>> {
  const runs = await db.orm.public.Runs
    .select('id', 'variant', 'status', 'startedAt')
    .where((f) => f.ideaId.eq(ideaId))
    .orderBy((f) => f.startedAt.desc())
    .all()

  return runs.map(r => ({
    id: r.id,
    variant: r.variant,
    status: r.status,
    startedAt: r.startedAt,
  }))
}
