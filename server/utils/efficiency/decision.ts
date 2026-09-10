/**
 * Условия решения (TZ §5 п.5): порог полезного эффекта задан заранее,
 * отрицательный эффект / ухудшение качества / CI включая «без изменений»
 → автоматически влияет на рекомендацию. Детерминированно, без LLM.
 */

import type { CalculationResult } from './model'

import { QUALITY_THRESHOLD } from './model'

export type Recommendation = 'develop' | 'insufficient_data' | 'postpone' | 'reject' | 'validate_first'

export interface DecisionResult {
  recommendation: Recommendation
  /** Сработавшие правила — видны в отчёте (балл не скрывает стоп-фактор, TZ §4) */
  rules: Array<{ rule: string, triggered: boolean, action: string }>
  /** Минимальная рекомендация, навязанная правилами (стоп-фактор) */
  stopFactor: null | string
}

/** Порог полезного эффекта: минимум 0.5 мин/обращение (задан заранее, TZ §5 п.5) */
export const EFFECT_THRESHOLD_MIN = 0.5

/**
 * Применяет пороги к результату расчёта.
 * Правила упорядочены по строгости; худшая рекомендация выигрывает
 (стоп-фактор не может быть скрыт общим баллом).
 */
export function decide(result: CalculationResult, hasEnoughData: boolean): DecisionResult {
  const { baseline, mainVariant } = result
  const ciIncludesZero = mainVariant.bootstrap.ci.lower <= 0

  const rules = [
    {
      action: 'insufficient_data',
      rule: 'Недостаточно данных (менее 2 наблюдений или все пропуски)',
      triggered: !hasEnoughData,
    },
    {
      action: 'postpone',
      rule: `Эффект ${mainVariant.effectPerTicket.toFixed(2)} мин < порога ${EFFECT_THRESHOLD_MIN} мин`,
      triggered: mainVariant.effectPerTicket < EFFECT_THRESHOLD_MIN,
    },
    {
      action: 'validate_first',
      rule: `Качество ИИ ${(mainVariant.quality * 100).toFixed(1)}% ниже порога ${(QUALITY_THRESHOLD * 100).toFixed(0)}%`,
      triggered: mainVariant.quality < QUALITY_THRESHOLD,
    },
    {
      action: 'validate_first',
      rule: 'Доверительный интервал включает «без изменений» (CI lower ≤ 0)',
      triggered: ciIncludesZero,
    },
    {
      action: 'validate_first',
      rule: `Эффект ниже базовой ошибки процесса (меньше улучшения, чем даёт база 88% → цель)`,
      triggered: mainVariant.quality <= baseline.quality,
    },
  ]

  const severity: Record<Recommendation, number> = {
    develop: 0,
    insufficient_data: 3,
    postpone: 2,
    reject: 4,
    validate_first: 1,
  }

  let worst: Recommendation = 'develop'
  let stopFactor: null | string = null

  for (const r of rules) {
    if (r.triggered) {
      const action = r.action as Recommendation
      if (severity[action] > severity[worst]) {
        worst = action
        stopFactor = r.rule
      }
    }
  }

  return { recommendation: worst, rules, stopFactor }
}
