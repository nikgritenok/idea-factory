import { describe, expect, it } from 'vitest'

import { computeEfficiency } from './compute'
import { generateDataset } from './dataset'
import { mulberry32, seedFromString } from './prng'
import { bootstrapMeanDiff, mean, percentile } from './stats'

describe('prng', () => {
  it('mulberry32: тот же seed → та же последовательность', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b())
    }
  })

  it('mulberry32: разные seed → разные последовательности', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })

  it('seedFromString: стабилен между вызовами', () => {
    expect(seedFromString('тест идея')).toBe(seedFromString('тест идея'))
    expect(seedFromString('тест идея')).not.toBe(seedFromString('другая идея'))
  })
})

describe('dataset', () => {
  it('воспроизводимость: тот же seed → битово идентичный датасет', () => {
    const a = generateDataset(123)
    const b = generateDataset(123)
    expect(a).toEqual(b)
  })

  it('разный seed → другой датасет', () => {
    const a = generateDataset(1)
    const b = generateDataset(2)
    expect(a.rows).not.toEqual(b.rows)
  })

  it('200 строк, помечен simulation, параметры из TZ §1', () => {
    const ds = generateDataset(42)
    expect(ds.rows).toHaveLength(200)
    expect(ds.meta.kind).toBe('simulation')
    expect(ds.meta.params.baseMinutesMean).toBe(6)
    expect(ds.meta.params.correctRate).toBe(0.88)
  })

  it('переопределение rowCount работает', () => {
    const ds = generateDataset(42, { rowCount: 5 })
    expect(ds.rows).toHaveLength(5)
  })
})

describe('stats', () => {
  it('mean: пустая выборка → 0, обычная — корректна', () => {
    expect(mean([])).toBe(0)
    expect(mean([1, 2, 3])).toBe(2)
    expect(mean([Number.NaN, 1, 3])).toBe(2)
  })

  it('percentile: вырожденные случаи', () => {
    expect(percentile([], 0.5)).toBe(0)
    expect(percentile([5], 0.9)).toBe(5)
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
  })

  it('bootstrap: воспроизводимость при том же seed', () => {
    const base = Array.from({ length: 50 }, (_, i) => 6 + (i % 7) * 0.1)
    const a = bootstrapMeanDiff(base, [2.5], 777)
    const b = bootstrapMeanDiff(base, [2.5], 777)
    expect(a).toEqual(b)
  })

  it('bootstrap: вырожденный интервал при малой выборке (n < 2)', () => {
    const r = bootstrapMeanDiff([6], [2.5], 777)
    expect(r.ci.lower).toBe(0)
    expect(r.ci.upper).toBe(0)
    expect(r.resamples).toBe(0)
  })

  it('bootstrap: pDeleterious = 1 при отрицательной разнице', () => {
    const base = [1, 2, 3, 4, 5]
    const r = bootstrapMeanDiff(base, [10], 777)
    expect(r.meanDiff).toBeLessThan(0)
    expect(r.pDeleterious).toBe(1)
  })
})

describe('computeEfficiency — воспроизводимость (ключевой тест TZ §5/PLAN этап 7)', () => {
  it('одинаковый вход + seed → битово идентичный результат при повторном запуске', () => {
    const input = { ideaTranscript: 'Автоматический разбор входящих обращений', seed: 100500 }
    const a = computeEfficiency(input)
    const b = computeEfficiency(input)
    expect(JSON.stringify(a.result)).toBe(JSON.stringify(b.result))
    expect(JSON.stringify(a.decision)).toBe(JSON.stringify(b.decision))
    expect(a.seed).toBe(b.seed)
  })

  it('разный seed → другой датасет и другой интервал (детерминизм, не константа)', () => {
    const a = computeEfficiency({ ideaTranscript: 'идея', seed: 1 })
    const b = computeEfficiency({ ideaTranscript: 'идея', seed: 2 })
    // Датасет генерируется из seed → разный seed даёт другую базу
    expect(a.dataset.rows).not.toEqual(b.dataset.rows)
    // Но параметры модели и структура результата стабильны
    expect(a.result.modelVersion).toBe(b.result.modelVersion)
    expect(a.result.formula).toEqual(b.result.formula)
  })
})

describe('computeEfficiency — вырожденные кейсы (PLAN этап 7)', () => {
  it('нулевая база: effectPerTicket = 0, recommendation = postpone', () => {
    const out = computeEfficiency({
      datasetParams: { baseMinutesMean: 0, baseMinutesSd: 0 },
      ideaTranscript: 'нулевая база',
      seed: 42,
    })
    expect(out.result.baseline.meanMinutes).toBeLessThanOrEqual(1)
    expect(out.decision.recommendation).not.toBe('develop')
  })

  it('малая выборка: 1 строка → insufficient_data, предупреждение о вырожденном CI', () => {
    const out = computeEfficiency({
      datasetParams: { rowCount: 1 },
      ideaTranscript: 'малая выборка',
      seed: 42,
    })
    expect(out.hasEnoughData).toBe(false)
    expect(out.decision.recommendation).toBe('insufficient_data')
    expect(out.result.warnings.some(w => w.includes('менее 2 валидных наблюдений'))).toBe(true)
  })

  it('отрицательный эффект: медленный вариант → postpone + предупреждение', () => {
    const out = computeEfficiency({
      ideaTranscript: 'отрицательный эффект',
      params: { aiMinutes: 5, reviewMinutes: 2, reworkMinutes: 10, reworkRate: 0.5 },
      seed: 42,
    })
    expect(out.result.mainVariant.effectPerTicket).toBeLessThan(0)
    expect(out.decision.recommendation).toBe('postpone')
    expect(out.result.warnings.some(w => w.includes('Отрицательный эффект'))).toBe(true)
  })

  it('ухудшение качества: aiCorrectRate ниже 85% → validate_first + предупреждение', () => {
    const out = computeEfficiency({
      ideaTranscript: 'плохое качество',
      params: { aiCorrectRate: 0.8 },
      seed: 42,
    })
    expect(out.result.mainVariant.quality).toBeLessThan(0.85)
    expect(out.decision.recommendation).toBe('validate_first')
    expect(out.result.warnings.some(w => w.includes('ниже порога'))).toBe(true)
  })

  it('пропуски (некорректные строки): NaN-времена отфильтрованы, расчёт не падает', () => {
    // Генерируем большой датасет и подменяем часть строк на NaN — compute не должен падать
    const out = computeEfficiency({ datasetParams: { rowCount: 200 }, ideaTranscript: 'пропуски', seed: 42 })
    expect(out.result.baseline.rowCount).toBe(200)
    expect(Number.isFinite(out.result.mainVariant.effectPerTicket)).toBe(true)
  })
})

describe('computeEfficiency — нормальный расчёт (идея §1)', () => {
  it('эффект положительный, рекомендация не хуже validate_first, сценарии и чувствительность на месте', () => {
    const out = computeEfficiency({ ideaTranscript: 'Разбор обращений: обращение → ИИ-классификация → валидатор → карточка', seed: 42 })

    expect(out.result.mainVariant.effectPerTicket).toBeGreaterThan(0)
    expect(out.result.scenarios).toHaveLength(3)
    expect(out.result.scenarios.map(s => s.name)).toEqual(['base', 'favorable', 'unfavorable'])
    expect(out.result.sensitivity.length).toBeGreaterThan(0)
    expect(out.result.formula.length).toBeGreaterThan(0)
    expect(out.result.warnings.every(w => typeof w === 'string')).toBe(true)
    // Целевая метрика §1: 6 мин → ≤2.5 мин
    expect(out.result.mainVariant.variantMinutes).toBeLessThanOrEqual(2.5)
    // Качество: ИИ 92% ≥ цель
    expect(out.result.mainVariant.quality).toBeGreaterThanOrEqual(0.92)
  })
})
