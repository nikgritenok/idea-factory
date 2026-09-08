/**
 * Модельный датасет обращений (TZ §1, §15).
 * 200 обращений: время обработки, корректность классификации, ручная доработка.
 * Параметры процесса из §1: 6 мин/обращение, 88% корректных, ~8% возврат на доработку.
 * Пометка: SIMULATION — не измерение реального процесса (TZ §15, реестр допущений).
 */

import { mulberry32, type Rng } from './prng'

export interface TicketRow {
  id: number
  /** Время обработки оператором, минуты */
  manualMinutes: number
  /** Классификация оператором корректна */
  manualCorrect: boolean
  /** Обращение возвращалось на доработку */
  reworked: boolean
  /** Категория обращения (для MVP-сценария §10) */
  category: 'вопрос' | 'жалоба' | 'запрос' | 'предложение'
}

export interface GeneratedDataset {
  rows: readonly TicketRow[]
  meta: {
    kind: 'simulation'
    seed: number
    rowCount: number
    /** Параметры генерации — сохраняются вместе с данными (TZ §5 п.1) */
    params: {
      baseMinutesMean: number
      baseMinutesSd: number
      correctRate: number
      reworkRate: number
    }
  }
}

/** Box–Muller: нормальное распределение из равномерного RNG */
function normal(rng: Rng, mean: number, sd: number): number {
  const u1 = Math.max(rng(), Number.EPSILON)
  const u2 = rng()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + sd * z
}

export const DATASET_DEFAULTS = {
  baseMinutesMean: 6,
  baseMinutesSd: 1.5,
  correctRate: 0.88,
  reworkRate: 0.08,
  rowCount: 200,
} as const

const CATEGORIES = ['вопрос', 'жалоба', 'запрос', 'предложение'] as const

/**
 * Генерирует модельный датасет. Тот же seed → тот же датасет (тест детерминизма).
 * Нулевая база / вырожденные случаи проверяются тестами на compute (см. compute.ts).
 */
export function generateDataset(seed: number, overrides: Partial<typeof DATASET_DEFAULTS> = {}): GeneratedDataset {
  const params = { ...DATASET_DEFAULTS, ...overrides }
  const rng = mulberry32(seed)
  const rows: TicketRow[] = []

  for (let i = 0; i < params.rowCount; i++) {
    // Время — нормальное, обрезаем снизу на 1 мин (нереалистично быстрее)
    const manualMinutes = Math.max(1, normal(rng, params.baseMinutesMean, params.baseMinutesSd))
    const manualCorrect = rng() < params.correctRate
    // Доработка чаще следует за некорректной классификацией
    const reworked = manualCorrect ? rng() < params.reworkRate * 0.5 : rng() < params.reworkRate * 3

    const catIdx = Math.floor(rng() * CATEGORIES.length)
    rows.push({
      id: i + 1,
      manualMinutes: Math.round(manualMinutes * 100) / 100,
      manualCorrect,
      reworked,
      category: CATEGORIES[catIdx] as TicketRow['category'],
    })
  }

  return {
    rows,
    meta: {
      kind: 'simulation',
      seed,
      rowCount: rows.length,
      params: {
        baseMinutesMean: params.baseMinutesMean,
        baseMinutesSd: params.baseMinutesSd,
        correctRate: params.correctRate,
        reworkRate: params.reworkRate,
      },
    },
  }
}

/** Сводка датасета для input_summary (TZ §5 п.1: источник, число наблюдений, пропуски) */
export function datasetSummary(ds: GeneratedDataset): Record<string, unknown> {
  const valid = ds.rows.filter(r => Number.isFinite(r.manualMinutes) && r.manualMinutes > 0)
  const missing = ds.rows.length - valid.length
  const totalMinutes = valid.reduce((s, r) => s + r.manualMinutes, 0)
  const correct = valid.filter(r => r.manualCorrect).length
  const reworked = valid.filter(r => r.reworked).length

  return {
    kind: ds.meta.kind,
    seed: ds.meta.seed,
    rowCount: ds.rows.length,
    missingCount: missing,
    missingRate: ds.rows.length > 0 ? missing / ds.rows.length : 0,
    meanMinutes: valid.length > 0 ? totalMinutes / valid.length : 0,
    correctRate: valid.length > 0 ? correct / valid.length : 0,
    reworkRate: valid.length > 0 ? reworked / valid.length : 0,
    unit: 'минуты на обращение',
  }
}
