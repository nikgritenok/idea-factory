/**
 * Статистическая модель (TZ §5 п.3): bootstrap доверительный интервал 95%
 * для средней разницы «база − вариант». Seed фиксируется → воспроизводимо.
 */

import { mulberry32 } from './prng'

export interface BootstrapResult {
  ci: { lower: number, upper: number }
  /** Точечная оценка разницы средних (base − variant) */
  meanDiff: number
  /** Доля ресемплов, где разница ≤ 0 (включает «без изменений») */
  pDeleterious: number
  resamples: number
  seed: number
}

const DEFAULT_RESAMPLES = 10_000

/** Среднее арифметическое; пустая/невалидная выборка → 0 (вырожденные кейсы) */
export function mean(values: readonly number[]): number {
  const valid = values.filter(v => Number.isFinite(v))
  if (valid.length === 0)
    return 0
  return valid.reduce((s, v) => s + v, 0) / valid.length
}

/** Процентиль линейной интерполяцией; пустая выборка → 0 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0)
    return 0
  if (sorted.length === 1)
    return sorted[0] as number
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi)
    return sorted[lo] as number
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * (idx - lo)
}

/**
 * Bootstrap CI 95% разницы средних base − variant.
 * Парный ресемплинг: из обоих наборов тянем по n со своим rng.
 * Малая выборка (n < 2) → вырожденный интервал [0, 0] с предупреждением наверху.
 */
export function bootstrapMeanDiff(
  base: readonly number[],
  variant: readonly number[],
  seed: number,
  resamples: number = DEFAULT_RESAMPLES,
): BootstrapResult {
  const baseValid = base.filter(v => Number.isFinite(v))
  const variantValid = variant.filter(v => Number.isFinite(v))

  const meanDiff = mean(baseValid) - mean(variantValid)

  if (baseValid.length < 2 || variantValid.length < 2) {
    return { ci: { lower: 0, upper: 0 }, meanDiff, pDeleterious: meanDiff <= 0 ? 1 : 0, resamples: 0, seed }
  }

  const rng = mulberry32(seed)
  const diffs: number[] = new Array(resamples)

  for (let i = 0; i < resamples; i++) {
    let sumB = 0
    let sumV = 0
    for (let j = 0; j < baseValid.length; j++) {
      sumB += baseValid[Math.floor(rng() * baseValid.length)] as number
    }
    for (let j = 0; j < variantValid.length; j++) {
      sumV += variantValid[Math.floor(rng() * variantValid.length)] as number
    }
    diffs[i] = sumB / baseValid.length - sumV / variantValid.length
  }

  const sorted = [...diffs].sort((a, b) => a - b)
  const deleterious = diffs.filter(d => d <= 0).length

  return {
    ci: { lower: percentile(sorted, 0.025), upper: percentile(sorted, 0.975) },
    meanDiff,
    pDeleterious: deleterious / resamples,
    resamples,
    seed,
  }
}
