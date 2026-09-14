/**
 * Контракт карточки эффективности между сервером и UI.
 *
 * Тип живёт в `shared/`, а не в `server/utils/efficiency-view.ts`: клиент не имеет
 * права импортировать `server/**` (правило архитектуры в eslint), но обязан знать
 * форму того, что рендерит. Реализация сборки — на сервере (TZ §5: числа считает
 * детерминированный серверный код, клиент только форматирует вывод).
 */
export interface EfficiencyView {
  badgeTone: 'neutral' | 'positive' | 'risk' | 'warn'
  calculationId: string
  ci: null | { level: string, text: string }
  /** Есть ли у CI реальный разброс: вырожденный интервал показывать нельзя */
  ciUsable: boolean
  createdAt: string
  decision: null | {
    label: string
    recommendation: string
    threshold: string
    triggeredRules: string[]
  }
  headline: { after: string, before: string, fasterPercent: null | number }
  howCalculated: {
    formula: string[]
    modelVersion: null | string
    params: Array<{ label: string, value: string }>
    seed: string
    units: Array<{ label: string, value: string }>
    warnings: string[]
  }
  methodLine: string
  perTicket: { from: string, to: string }
  quality: null | string
  scenarios: Array<{ effect: string, label: string, quality: string, volume: string }>
  volume: { hours: string, tickets: string }
}

/** Строка ответа GET /api/ideas/:id/calculations */
export interface CalculationRow {
  createdAt: string
  formula: string
  id: string
  inputSummary: unknown
  modelVersion: string
  params: unknown
  result: unknown
  seed: string
  view: EfficiencyView | null
  warnings: unknown
}
