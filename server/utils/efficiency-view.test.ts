import { describe, expect, it } from 'vitest'

import { type EfficiencyView, buildEfficiencyView } from './efficiency-view'

/** Снимок реальной строки `calculations` (страховое агентство, прогон 2026-09-14). */
function row(overrides: { ci?: { lower: number, upper: number }, recommendation?: string } = {}) {
  const ci = overrides.ci ?? { lower: 0, upper: 0 }
  return {
    createdAt: '2026-09-14 01:18:08.273951+00',
    formula: 'variant_minutes = ai_minutes + review_minutes + rework_rate × rework_minutes',
    id: 'calc-1',
    modelVersion: 'v1-efficiency',
    params: { aiCorrectRate: 0.92, aiMinutes: 0.5, monthlyVolume: 200, reviewMinutes: 1.5 },
    result: {
      decision: {
        recommendation: overrides.recommendation ?? 'develop',
        rules: [
          { action: 'insufficient_data', rule: 'Недостаточно данных', triggered: false },
          { action: 'postpone', rule: 'Эффект 3,7 мин < порога 0,5 мин', triggered: false },
          { action: 'validate_first', rule: 'Доверительный интервал включает «без изменений» (CI lower ≤ 0)', triggered: ci.lower <= 0 },
        ],
        stopFactor: null,
      },
      result: {
        baseline: { meanMinutes: 5.97, quality: 0.88, rowCount: 200 },
        formula: ['variant_minutes = …', 'effect_per_ticket = …', 'effect_volume = …'],
        mainVariant: {
          bootstrap: { ci, meanDiff: 3.72, pDeleterious: 0, resamples: 10_000, seed: 1024622360 },
          effectPerTicket: 3.72,
          effectVolumeHours: 12.4,
          quality: 0.92,
          variantMinutes: 2.3,
        },
        modelVersion: 'v1-efficiency',
        scenarios: [
          { ci, effectPerTicket: 3.72, effectVolumeHours: 12.4, name: 'base', quality: 0.92 },
          { ci, effectPerTicket: 4.07, effectVolumeHours: 13.6, name: 'favorable', quality: 0.95 },
          { ci, effectPerTicket: 3.15, effectVolumeHours: 10.5, name: 'unfavorable', quality: 0.84 },
        ],
        units: { effectPerTicket: 'минуты на обращение', quality: 'доля корректных классификаций (0–1)' },
        warnings: ['SIMULATION: датасет модельный (TZ §15), не измерение реального процесса'],
      },
    },
    seed: '3947182029',
    warnings: ['SIMULATION: датасет модельный (TZ §15), не измерение реального процесса'],
  }
}

describe('Карточка эффективности (view-модель сервера)', () => {
  it('заголовок: было → стало и % ускорения из серверных полей', () => {
    const view = buildEfficiencyView(row()) as EfficiencyView
    // (5,97 − 2,3) / 5,97 = 61,47 → округляем до целого на сервере
    expect(view.headline).toEqual({ after: '2,3 мин', before: '6 мин', fasterPercent: 61 })
    expect(view.perTicket).toEqual({ from: '6 мин', to: '2,3 мин' })
    expect(view.volume).toEqual({ hours: '12,4 ч', tickets: '200' })
  })

  it('качество ИИ — доля наружу процентом', () => {
    const view = buildEfficiencyView(row()) as EfficiencyView
    expect(view.quality).toBe('92%')
  })

  it('вырожденный CI не показывается (нельзя врать о точности)', () => {
    const view = buildEfficiencyView(row({ ci: { lower: 0, upper: 0 } })) as EfficiencyView
    expect(view.ciUsable).toBe(false)
    expect(view.ci).toBeNull()
  })

  it('настоящий CI отдаётся текстом', () => {
    const view = buildEfficiencyView(row({ ci: { lower: 3.53, upper: 3.92 } })) as EfficiencyView
    expect(view.ciUsable).toBe(true)
    expect(view.ci?.text).toBe('3,5 мин – 3,9 мин')
  })

  it('сценарии подписаны по-русски и их три', () => {
    const view = buildEfficiencyView(row()) as EfficiencyView
    expect(view.scenarios.map(s => s.label)).toEqual(['Базовый', 'Благоприятный', 'Неблагоприятный'])
    expect(view.scenarios[2]?.quality).toBe('84%')
  })

  it('рекомендация — метка + тон бейджа', () => {
    expect((buildEfficiencyView(row({ recommendation: 'develop' })) as EfficiencyView).badgeTone).toBe('positive')
    expect((buildEfficiencyView(row({ recommendation: 'validate_first' })) as EfficiencyView).decision?.label).toBe('Сначала провалидировать')
    expect((buildEfficiencyView(row({ recommendation: 'reject' })) as EfficiencyView).badgeTone).toBe('risk')
  })

  it('порог решения — непроработавшее правило, сработавшие вынесены отдельно', () => {
    const view = buildEfficiencyView(row()) as EfficiencyView
    expect(view.decision?.threshold).toContain('порога')
    expect(view.decision?.triggeredRules.some(r => r.includes('Доверительный интервал'))).toBe(true)
  })

  it('раскрытие «Как считали» несёт формулы, единицы, seed и предупреждение о симуляции', () => {
    const view = buildEfficiencyView(row()) as EfficiencyView
    expect(view.howCalculated.formula).toHaveLength(3)
    expect(view.howCalculated.seed).toBe('3947182029')
    expect(view.howCalculated.units.some(u => u.label === 'Эффект на заявку, мин')).toBe(true)
    expect(view.howCalculated.warnings[0]).toContain('SIMULATION')
    // Разделитель тысяч в ru-RU — неразрывный пробел (U+00A0), поэтому проверяем
    // шаблоном: обычное `'10 000'` через toContain не совпадёт, и это не баг кода.
    expect(view.methodLine).toMatch(/bootstrap 10\s000 ресемплирований/u)
    expect(view.methodLine).toContain('не ИИ')
  })

  it('строка без result.decision/result не превращается в карточку из прочерков', () => {
    expect(buildEfficiencyView({ ...row(), result: undefined })).toBeNull()
  })

  it('формат чисел — русская локаль (десятичная запятая, разделитель тысяч)', () => {
    const view = buildEfficiencyView(row()) as EfficiencyView
    expect(view.headline.after).toContain('2,3')
    expect(view.methodLine).toMatch(/10\s\d{3}/u)
  })
})
