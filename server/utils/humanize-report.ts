/**
 * Приводит прозу агентов к читаемому виду на границе API.
 *
 * Роли пишут по-русски, но в текст попадают сырые токены расчёта
 * (`meanMinutes ~6 мин, rowCount 200`, `3.57 мин`) — модель копирует их из
 * входных данных. Пользователь по ТЗ §4 видит человеческий язык, техника —
 * только в материалах фазы и в «режиме разработчика».
 *
 * Правка чисто оформительская и обратимая: смысл предложения не меняется,
 * меняются только написания. Поэтому она здесь, а не в промптах ролей.
 */

import { fieldLabel } from '~~/shared/field-labels'

/** Технические токены, которые модель приносит в текст. */
const TOKENS = [
  'aiCorrectRate',
  'aiMinutes',
  'bootstrap',
  'ciLower',
  'ciUpper',
  'effectPerTicket',
  'effectVolumeHours',
  'inputSummary',
  'mainVariant',
  'meanDiff',
  'meanMinutes',
  'modelVersion',
  'monthlyVolume',
  'params',
  'pDeleterious',
  'reworkMinutes',
  'reworkRate',
  'reviewMinutes',
  'rowCount',
  'seed',
  'stopFactors',
  'variantMinutes',
]

/**
 * `3.57 мин` → `3,57 мин`, `0.85` → `0,85`. Версии не трогаем: `2.5.1` — это не
 * одно число, а три группы; запятая появилась бы и внутри неё.
 */
function localizeDecimal(text: string): string {
  return text.replaceAll(/(?<![\d.])\d+\.\d+(?![\d.])/g, m => m.replace('.', ','))
}

function humanizeTokens(text: string): string {
  let out = text
  for (const token of TOKENS) {
    out = out.replaceAll(new RegExp(String.raw`\b${token}\b`, `g`), fieldLabel(token))
  }
  // `quality 92%` и `confidence medium` модель печатает латиницей даже в русском предложении
  out = out.replaceAll(/\bquality\b/gi, 'качество ИИ')
  return out
}

export function humanizeReportText(value: unknown): unknown {
  if (typeof value === 'string') {
    return localizeDecimal(humanizeTokens(value))
  }
  if (Array.isArray(value)) {
    return value.map(item => humanizeReportText(item))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = humanizeReportText(v)
    }
    return out
  }
  return value
}
