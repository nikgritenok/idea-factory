/**
 * Оркестрация расчёта (TZ §5): вход → мат. модель → bootstrap → сценарии
 → чувствительность → пороги. Полностью детерминированный код; LLM только
 комментирует результат (AGENTS.md: число из проверяемого вычисления).
 */

import type { CalculationResult, ModelParams } from './model'

import { decide } from './decision'
import { generateDataset, datasetSummary, type DatasetParams, type GeneratedDataset } from './dataset'
import { computeScenarios, computeSensitivity, computeVariant, MODEL_FORMULA, MODEL_VERSION, PARAM_DEFAULTS } from './model'
import { seedFromString } from './prng'

export interface EfficiencyInput {
  /** Транскрипт идеи (для seed-строки; может быть пустым) */
  ideaTranscript: string
  /** Переопределение параметров модели (для чувствительности и тестов) */
  params?: Partial<ModelParams>
  /** Переопределение параметров датасета (нулевая база, объём и т.д.) */
  datasetParams?: Partial<DatasetParams>
  /** Явный seed; по умолчанию — стабильный хеш транскрипта */
  seed?: number
}

export interface EfficiencyOutput {
  result: CalculationResult
  decision: ReturnType<typeof decide>
  /** Сводка датасета для calculations.input_summary */
  inputSummary: Record<string, unknown>
  /** Датасет — для записи в таблицу datasets при прогоне */
  dataset: GeneratedDataset
  seed: number
  /** Достаточно ли данных для решения (менее 2 валидных наблюдений → нет) */
  hasEnoughData: boolean
}

/**
 * Главная точка входа расчётного модуля.
 * Тот же вход + тот же seed → битово идентичный результат (тест воспроизводимости).
 */
export function computeEfficiency(input: EfficiencyInput): EfficiencyOutput {
  const seed = input.seed ?? seedFromString(`dataset|${input.ideaTranscript.slice(0, 200)}`)
  const ds = generateDataset(seed, input.datasetParams)

  const params: ModelParams = { ...PARAM_DEFAULTS, ...input.params }
  const mainVariant = computeVariant(ds, params, seed)
  const scenarios = computeScenarios(ds, params, seed)
  const sensitivity = computeSensitivity(ds, params)

  const warnings: string[] = []
  const validRows = ds.rows.filter(r => Number.isFinite(r.manualMinutes) && r.manualMinutes > 0)

  if (validRows.length < 2) {
    warnings.push('SIMULATION: менее 2 валидных наблюдений — bootstrap пропущен, CI вырожден')
  }
  warnings.push('SIMULATION: датасет модельный (TZ §15), не измерение реального процесса')
  if (ds.meta.params.baseMinutesMean <= 0) {
    warnings.push('Вырожденная база: среднее время базы ≤ 0 — эффект интерпретировать нельзя')
  }
  if (mainVariant.effectPerTicket < 0) {
    warnings.push('Отрицательный эффект: вариант медленнее базового процесса')
  }
  if (mainVariant.quality < 0.85) {
    warnings.push(`Качество ИИ ${(mainVariant.quality * 100).toFixed(1)}% ниже порога 85%`)
  }

  const result: CalculationResult = {
    modelVersion: MODEL_VERSION,
    formula: MODEL_FORMULA,
    units: {
      effectPerTicket: 'минуты на обращение',
      effectVolumeHours: 'часов в месяц',
      quality: 'доля корректных классификаций (0–1)',
      variantMinutes: 'минуты на обращение',
    },
    baseline: {
      meanMinutes: validRows.length > 0 ? validRows.reduce((s, r) => s + r.manualMinutes, 0) / validRows.length : 0,
      quality: validRows.length > 0 ? validRows.filter(r => r.manualCorrect).length / validRows.length : 0,
      reworkRate: validRows.length > 0 ? validRows.filter(r => r.reworked).length / validRows.length : 0,
      rowCount: ds.rows.length,
    },
    mainVariant,
    scenarios,
    sensitivity,
    warnings,
  }

  const decision = decide(result, validRows.length >= 2)

  return {
    result,
    decision,
    inputSummary: datasetSummary(ds),
    dataset: ds,
    seed,
    hasEnoughData: validRows.length >= 2,
  }
}
