/**
 * Человекочитаемое представление расчёта эффективности (Пункт 3 ТЗ).
 *
 * Почему на сервере, а не в компоненте: TZ §5 и AGENTS.md — числовые выводы
 * делает детерминированный серверный код, клиент не пересчитывает. Процент
 * «на сколько быстрее» — тоже производная величина, поэтому считается здесь,
 * из тех же полей, что лежат в `calculations.result`.
 *
 * Модуль чистый (без БД и без Nuxt) — проверяется тестом на снимке результата.
 */

import type { EfficiencyView } from '~~/shared/efficiency-view'

import { fieldLabel, fieldValueLabel } from '~~/shared/field-labels'

export type { EfficiencyView }

interface RawCi {
  lower?: number
  upper?: number
}

interface RawScenario {
  ci?: RawCi
  effectPerTicket?: number
  effectVolumeHours?: number
  name?: string
  quality?: number
}

interface RawResult {
  baseline?: { meanMinutes?: number, quality?: number, rowCount?: number }
  formula?: string[]
  mainVariant?: {
    bootstrap?: { ci?: RawCi, pDeleterious?: number, resamples?: number, seed?: number }
    effectPerTicket?: number
    effectVolumeHours?: number
    quality?: number
    variantMinutes?: number
  }
  modelVersion?: string
  scenarios?: RawScenario[]
  units?: Record<string, string>
  warnings?: string[]
}

interface RawDecision {
  recommendation?: null | string
  rules?: Array<{ action?: string, rule?: string, triggered?: boolean }>
  stopFactor?: unknown
}

interface Envelope {
  decision?: RawDecision
  result?: RawResult
}

/** Сужаем jsonb предикатом вместо силового каста: `unknown` ≠ доказанная форма. */
function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawCalcRow {
  createdAt: string
  formula?: string
  id: string
  modelVersion?: string
  /** jsonb-колонки: конкретную форму даёт БД, поэтому здесь unknown, а не Record */
  params?: unknown
  result?: unknown
  seed?: number | string
  warnings?: unknown
}

const RECOMMENDATION_LABELS: Record<string, string> = {
  develop: 'Развивать',
  insufficient_data: 'Недостаточно данных',
  postpone: 'Отложить',
  reject: 'Отклонить',
  validate_first: 'Сначала провалидировать',
}

const SCENARIO_LABELS: Record<string, string> = {
  base: 'Базовый',
  favorable: 'Благоприятный',
  unfavorable: 'Неблагоприятный',
}

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

function asNumber(v: unknown): null | number {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function minutes(v: null | number): string {
  return v === null ? '—' : `${nf.format(round1(v))} мин`
}

function hours(v: null | number): string {
  return v === null ? '—' : `${nf.format(round1(v))} ч`
}

function percent(v: null | number): string {
  return v === null ? '—' : `${nf.format(Math.round(v))}%`
}

function toneOf(recommendation: string): EfficiencyView['badgeTone'] {
  if (recommendation === 'develop') {
    return 'positive'
  }
  if (recommendation === 'reject') {
    return 'risk'
  }
  if (recommendation === 'insufficient_data' || recommendation === 'postpone') {
    return 'warn'
  }
  return 'neutral'
}

/**
 * Числа внутри человеческих строк решения приходят из decision-модуля с точкой
 * (`3.57 мин`), а весь отчёт — с запятой. Правим только отображение: строки
 * генерируются расчётом, и менять их формат на сервере смысла нет.
 */
function localizeNumbers(text: string): string {
  return text.replaceAll(/\d+\.\d+/g, m => m.replace('.', ','))
}

/**
 * View-модель из строки `calculations`. null — если строка на расчёт не похожа:
 * UI честно скажет «данных нет» вместо карточки из прочерков.
 */
export function buildEfficiencyView(row: RawCalcRow): EfficiencyView | null {
  const envelope = isEnvelope(row.result) ? row.result : null
  const inner = envelope?.result
  const decision = envelope?.decision
  if (!inner || !decision) {
    return null
  }

  const main = inner.mainVariant ?? {}
  const bootstrap = main.bootstrap ?? {}
  const before = asNumber(inner.baseline?.meanMinutes)
  const after = asNumber(main.variantMinutes)
  const lower = asNumber(bootstrap.ci?.lower)
  const upper = asNumber(bootstrap.ci?.upper)
  const resamples = asNumber(bootstrap.resamples)

  const fasterPercent = before !== null && after !== null && before > 0
    ? Math.round(((before - after) / before) * 100)
    : null

  // CI [0, 0] и lower === upper — вырожденные случаи (мало наблюдений или старая
  // версия расчёта до правки bootstrap'а). «95% CI: 3,6–3,6» = врать о точности.
  const ciUsable = lower !== null && upper !== null && upper > lower

  const recommendation = decision.recommendation ?? ''
  const rules = decision.rules ?? []
  const triggeredRules = rules.filter(r => r.triggered).map(r => localizeNumbers(r.rule ?? '')).filter(Boolean)
  // Порог решения — то правило-условие, которое НЕ сработало (оно и описывает рамку)
  const thresholdRule = rules.find(r => !r.triggered && /порог|ниже|меньше/i.test(r.rule ?? ''))

  const paramsSource = (row.params ?? {}) as Record<string, unknown>
  const params = Object.entries(paramsSource)
    .filter(([, v]) => v === null || typeof v !== 'object')
    .map(([k, v]) => ({
      label: fieldLabel(k),
      value: typeof v === 'number' ? nf.format(round1(v)) : String(v ?? '—'),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))

  const warnings = [
    ...(inner.warnings ?? []),
    ...(Array.isArray(row.warnings) ? row.warnings as string[] : []),
  ]

  // Качество в данных — доля (0.92), наружу отдаём процент: «92%» читается
  // без пересчёта в голове, а «0.92» в карточке выглядит как опечатка.
  const qualityValue = asNumber(main.quality) ?? asNumber(inner.baseline?.quality)

  return {
    badgeTone: toneOf(recommendation),
    calculationId: row.id,
    ci: ciUsable ? { level: '95%', text: `${minutes(lower)} – ${minutes(upper)}` } : null,
    ciUsable,
    createdAt: row.createdAt,
    decision: recommendation
      ? {
          label: RECOMMENDATION_LABELS[recommendation] ?? fieldValueLabel(recommendation),
          recommendation,
          threshold: thresholdRule ? localizeNumbers(thresholdRule.rule ?? '') : 'Порог: эффект должен превышать базовую ошибку процесса',
          triggeredRules,
        }
      : null,
    headline: {
      after: minutes(after),
      before: minutes(before),
      fasterPercent,
    },
    howCalculated: {
      formula: inner.formula ?? (row.formula ? [row.formula] : []),
      modelVersion: inner.modelVersion ?? row.modelVersion ?? null,
      params,
      seed: String(row.seed ?? bootstrap.seed ?? '—'),
      units: Object.entries(inner.units ?? {}).map(([k, v]) => ({ label: fieldLabel(k), value: String(v) })),
      warnings: [...new Set(warnings)],
    },
    methodLine: `Расчёт детерминированный (не ИИ): ${inner.formula?.length ?? 0} формул, bootstrap ${resamples === null ? '—' : nf.format(resamples)} ресемплирований, seed зафиксирован`,
    perTicket: { from: minutes(before), to: minutes(after) },
    quality: qualityValue === null ? null : percent(qualityValue * 100),
    scenarios: (inner.scenarios ?? []).map((s) => {
      const sQuality = asNumber(s.quality)
      return {
        effect: minutes(asNumber(s.effectPerTicket)),
        label: SCENARIO_LABELS[s.name ?? ''] ?? fieldValueLabel(s.name ?? ''),
        quality: sQuality === null ? '—' : percent(sQuality * 100),
        volume: hours(asNumber(s.effectVolumeHours)),
      }
    }),
    volume: {
      hours: hours(asNumber(main.effectVolumeHours)),
      tickets: inner.baseline?.rowCount === undefined ? '—' : String(inner.baseline.rowCount),
    },
  }
}
