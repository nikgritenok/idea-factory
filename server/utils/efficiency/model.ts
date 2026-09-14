/**
 * Математическая модель эффекта (TZ §5 п.2, п.4).
 * Формулы и единицы — явные, часть результата (видны в отчёте).
 * Числа — только из этого детерминированного кода, не из LLM (AGENTS.md).
 */

import type { GeneratedDataset, TicketRow } from './dataset'

import { bootstrapMeanDiff, type BootstrapResult } from './stats'

export const MODEL_VERSION = 'v1-efficiency'

/** Формула модели — строкой, хранится в result и отчёте (TZ §5: формулы видны) */
export const MODEL_FORMULA = [
  'variant_minutes = ai_minutes + review_minutes + rework_rate × rework_minutes',
  'effect_per_ticket = mean(base_minutes) − variant_minutes',
  'effect_volume = effect_per_ticket × ticket_count (часов/мес)',
  'quality = correct_rate(ai); порог 0.85, цель ≥ 0.92',
] as const

export interface ModelParams {
  /** Ожидаемая доля корректных классификаций у ИИ (0–1) */
  aiCorrectRate: number
  /** Время ИИ-обработки одного обращения, мин (допущение методики — TZ §15) */
  aiMinutes: number
  /** Число обращений в месяц (для объёмного эффекта) */
  monthlyVolume: number
  /** Время ручной проверки ИИ-черновика, мин */
  reviewMinutes: number
  /** Время доработки, мин */
  reworkMinutes: number
  /** Доля обращений с ручной доработкой после ИИ (0–1) */
  reworkRate: number
}

export const PARAM_DEFAULTS: ModelParams = {
  aiCorrectRate: 0.92,
  aiMinutes: 0.5,
  monthlyVolume: 200,
  reviewMinutes: 1.5,
  reworkMinutes: 4,
  reworkRate: 0.1,
}

/** Качественный порог из TZ §1: ниже 85% вариант не проходит */
export const QUALITY_THRESHOLD = 0.85
export const QUALITY_TARGET = 0.92

/** Результат расчёта одного варианта */
export interface VariantResult {
  bootstrap: BootstrapResult
  /** effect_per_ticket, мин */
  effectPerTicket: number
  /** effect_volume, часов в месяц */
  effectVolumeHours: number
  /** Корректность варианта (0–1) */
  quality: number
  /** variant_minutes по формуле */
  variantMinutes: number
}

/** Один сценарий (базовый/благоприятный/неблагоприятный) */
export interface ScenarioResult {
  ci: { lower: number, upper: number }
  effectPerTicket: number
  effectVolumeHours: number
  name: 'base' | 'favorable' | 'unfavorable'
  params: ModelParams
  quality: number
}

/** Итог расчёта — сохраняется в calculations.result (jsonb) */
export interface CalculationResult {
  baseline: {
    meanMinutes: number
    quality: number
    reworkRate: number
    rowCount: number
  }
  formula: readonly string[]
  mainVariant: VariantResult
  modelVersion: string
  scenarios: ScenarioResult[]
  /** Чувствительность: изменение параметра → изменение эффекта (TZ §5 п.4) */
  sensitivity: Array<{ param: keyof ModelParams, change: string, effectPerTicketDelta: number }>
  units: Record<string, string>
  warnings: string[]
}

/** variant_minutes по формуле модели */
export function variantMinutes(p: ModelParams): number {
  return p.aiMinutes + p.reviewMinutes + p.reworkRate * p.reworkMinutes
}

/**
 * Расчёт варианта: per-ticket эффект + bootstrap CI по датасету.
 * База — реальные строки датасета; вариант — детерминированная формула
 * (bootstrap ресемплит базовые времена против константы варианта).
 */
export function computeVariant(
  ds: GeneratedDataset,
  p: ModelParams,
  seed: number,
): VariantResult {
  // «Валидная база» определяется здесь ровно как в meanBase (finite и > 0), иначе
  // точечная оценка bootstrap и «средняя база» в отчёте расходились бы.
  const baseTimes = ds.rows
    .map((r: TicketRow) => r.manualMinutes)
    .filter(v => Number.isFinite(v) && v > 0)
  const vm = variantMinutes(p)
  // Вариант — константа по формуле, но bootstrap'у нужна выборка: с `[vm]` из одного
  // элемента срабатывал guard «n < 2» и CI всегда возвращался вырожденным [0, 0],
  // поэтому правило «CI включает без изменений» срабатывало для ЛЮБОЙ идеи и
  // рекомендация была структурно приземлена в validate_first. Ресемплинг константы
  // даёт разброс только по базе — это и есть намерение модели («base против варианта»).
  const variantTimes = new Array<number>(baseTimes.length).fill(vm)
  const bootstrap = bootstrapMeanDiff(baseTimes, variantTimes, seed)

  return {
    bootstrap,
    effectPerTicket: bootstrap.meanDiff,
    effectVolumeHours: (bootstrap.meanDiff * p.monthlyVolume) / 60,
    quality: p.aiCorrectRate,
    variantMinutes: vm,
  }
}

/**
 * 3 сценария: базовый, благоприятный (быстрее/качественнее ИИ, меньше доработки),
 * неблагоприятный (медленнее, больше доработки, ниже качество).
 */
export function computeScenarios(
  ds: GeneratedDataset,
  base: ModelParams,
  // CI сценариев считается bootstrap'ом, поэтому seed участвует и здесь: bounds
  // воспроизводимы ровно при том же seed, который сохранён вместе с результатом (TZ §5).
  seed: number,
): ScenarioResult[] {
  const variants: Array<{ name: ScenarioResult['name'], overrides: Partial<ModelParams> }> = [
    { name: 'base', overrides: {} },
    {
      name: 'favorable',
      overrides: { aiCorrectRate: Math.min(0.97, base.aiCorrectRate + 0.03), aiMinutes: base.aiMinutes * 0.7, reworkRate: base.reworkRate * 0.5 },
    },
    {
      name: 'unfavorable',
      overrides: { aiCorrectRate: Math.max(0.7, base.aiCorrectRate - 0.08), aiMinutes: base.aiMinutes * 1.5, reworkRate: base.reworkRate * 1.8 },
    },
  ]

  return variants.map(({ name, overrides }) => {
    const p = { ...base, ...overrides }
    // Сценарий считается тем же computeVariant, что и заголовок: раньше ci
    // подставлялся точечной оценкой ({lower: effect, upper: effect}), и «95% CI:
    // 3.57–3.57» в UI означало бы либо сломанную статистику, либо подделку.
    const v = computeVariant(ds, p, seed)
    return {
      ci: v.bootstrap.ci,
      effectPerTicket: v.effectPerTicket,
      effectVolumeHours: v.effectVolumeHours,
      name,
      params: p,
      quality: v.quality,
    }
  })
}

/** Чувствительность: ±20% по каждому ключевому параметру → дельта эффекта */
export function computeSensitivity(
  ds: GeneratedDataset,
  base: ModelParams,
): Array<{ param: keyof ModelParams, change: string, effectPerTicketDelta: number }> {
  const baseEffect = meanBase(ds) - variantMinutes(base)
  const keys: Array<keyof ModelParams> = ['aiMinutes', 'reviewMinutes', 'reworkRate', 'reworkMinutes', 'aiCorrectRate']

  return keys.map((param) => {
    const p20 = { ...base, [param]: base[param] * 1.2 }
    const m20 = { ...base, [param]: base[param] * 0.8 }
    const e20 = meanBase(ds) - variantMinutes(p20)
    const em20 = meanBase(ds) - variantMinutes(m20)
    const delta = Math.max(Math.abs(e20 - baseEffect), Math.abs(em20 - baseEffect))
    return { change: '±20%', effectPerTicketDelta: Math.round(delta * 1000) / 1000, param }
  }).sort((a, b) => b.effectPerTicketDelta - a.effectPerTicketDelta)
}

function meanBase(ds: GeneratedDataset): number {
  const valid = ds.rows.filter(r => Number.isFinite(r.manualMinutes) && r.manualMinutes > 0)
  if (valid.length === 0)
    return 0
  return valid.reduce((s, r) => s + r.manualMinutes, 0) / valid.length
}
