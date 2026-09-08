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
  /** Время ИИ-обработки одного обращения, мин (допущение методики — TZ §15) */
  aiMinutes: number
  /** Время ручной проверки ИИ-черновика, мин */
  reviewMinutes: number
  /** Доля обращений с ручной доработкой после ИИ (0–1) */
  reworkRate: number
  /** Время доработки, мин */
  reworkMinutes: number
  /** Ожидаемая доля корректных классификаций у ИИ (0–1) */
  aiCorrectRate: number
  /** Число обращений в месяц (для объёмного эффекта) */
  monthlyVolume: number
}

export const PARAM_DEFAULTS: ModelParams = {
  aiMinutes: 0.5,
  reviewMinutes: 1.5,
  reworkRate: 0.1,
  reworkMinutes: 4,
  aiCorrectRate: 0.92,
  monthlyVolume: 200,
}

/** Качественный порог из TZ §1: ниже 85% вариант не проходит */
export const QUALITY_THRESHOLD = 0.85
export const QUALITY_TARGET = 0.92

/** Результат расчёта одного варианта */
export interface VariantResult {
  /** variant_minutes по формуле */
  variantMinutes: number
  /** effect_per_ticket, мин */
  effectPerTicket: number
  /** effect_volume, часов в месяц */
  effectVolumeHours: number
  /** Корректность варианта (0–1) */
  quality: number
  bootstrap: BootstrapResult
}

/** Один сценарий (базовый/благоприятный/неблагоприятный) */
export interface ScenarioResult {
  name: 'base' | 'favorable' | 'unfavorable'
  params: ModelParams
  effectPerTicket: number
  effectVolumeHours: number
  quality: number
  ci: { lower: number, upper: number }
}

/** Итог расчёта — сохраняется в calculations.result (jsonb) */
export interface CalculationResult {
  modelVersion: string
  formula: readonly string[]
  units: Record<string, string>
  baseline: {
    meanMinutes: number
    quality: number
    reworkRate: number
    rowCount: number
  }
  mainVariant: VariantResult
  scenarios: ScenarioResult[]
  /** Чувствительность: изменение параметра → изменение эффекта (TZ §5 п.4) */
  sensitivity: Array<{ param: keyof ModelParams, change: string, effectPerTicketDelta: number }>
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
  const baseTimes = ds.rows.map((r: TicketRow) => r.manualMinutes)
  const vm = variantMinutes(p)
  const bootstrap = bootstrapMeanDiff(baseTimes, [vm], seed)

  return {
    variantMinutes: vm,
    effectPerTicket: bootstrap.meanDiff,
    effectVolumeHours: (bootstrap.meanDiff * p.monthlyVolume) / 60,
    quality: p.aiCorrectRate,
    bootstrap,
  }
}

/**
 * 3 сценария: базовый, благоприятный (быстрее/качественнее ИИ, меньше доработки),
 * неблагоприятный (медленнее, больше доработки, ниже качество).
 */
export function computeScenarios(
  ds: GeneratedDataset,
  base: ModelParams,
  seed: number,
): ScenarioResult[] {
  const variants: Array<{ name: ScenarioResult['name'], overrides: Partial<ModelParams> }> = [
    { name: 'base', overrides: {} },
    {
      name: 'favorable',
      overrides: { aiMinutes: base.aiMinutes * 0.7, reworkRate: base.reworkRate * 0.5, aiCorrectRate: Math.min(0.97, base.aiCorrectRate + 0.03) },
    },
    {
      name: 'unfavorable',
      overrides: { aiMinutes: base.aiMinutes * 1.5, reworkRate: base.reworkRate * 1.8, aiCorrectRate: Math.max(0.7, base.aiCorrectRate - 0.08) },
    },
  ]

  return variants.map(({ name, overrides }) => {
    const p = { ...base, ...overrides }
    const vm = variantMinutes(p)
    const effect = meanBase(ds) - vm
    return {
      name,
      params: p,
      effectPerTicket: effect,
      effectVolumeHours: (effect * p.monthlyVolume) / 60,
      quality: p.aiCorrectRate,
      ci: { lower: effect, upper: effect },
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
    return { param, change: '±20%', effectPerTicketDelta: Math.round(delta * 1000) / 1000 }
  }).sort((a, b) => b.effectPerTicketDelta - a.effectPerTicketDelta)
}

function meanBase(ds: GeneratedDataset): number {
  const valid = ds.rows.filter(r => Number.isFinite(r.manualMinutes) && r.manualMinutes > 0)
  if (valid.length === 0)
    return 0
  return valid.reduce((s, r) => s + r.manualMinutes, 0) / valid.length
}
