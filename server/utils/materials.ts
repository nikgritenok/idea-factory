/**
 * Детерминированная сборка MD-материалов фазы из того, что лежит в БД.
 *
 * Выход роли (`agent_outputs.output`) — jsonb вида `{ data, metadata }`. Два
 * правила здесь дороже красоты:
 *  1) jsonb НЕ сохраняет порядок ключей → обход строго канонический
 *     (сначала известные поля в заданном порядке, дальше остальные по алфавиту),
 *     иначе один и тот же материал отдаётся по-разному от запроса к запросу;
 *  2) никакого HTML: наружу идут блоки (`blocks`), из которых UI собирает
 *     настоящие элементы. `v-html` над текстами модели — XSS-поверхность, а
 *     `vue/no-v-html` в этом репозитории включён не случайно.
 */

import type { MaterialBlock } from '~~/shared/material-blocks'

import { fieldLabel, fieldValueLabel } from '~~/shared/field-labels'
import { phaseTitle } from '~~/shared/phase-names'

export type { MaterialBlock }

export interface MaterialsInput {
  /** Длительность шага, если известна (мс) */
  durationMs?: number
  /** Конец фазы (ISO) */
  finishedAt?: null | string
  /** Роль из agent_outputs.role */
  role: string
  /** Старт фазы (ISO) */
  startedAt?: null | string
  /** output из agent_outputs */
  value: unknown
}

/**
 * Предпочтительный порядок разделов (остальное — по алфавиту). Без этого список
 * фаз менялся бы местами между прогонами: jsonb сортирует ключи сам.
 */
const FIELD_ORDER = [
  'title',
  'problem',
  'audience',
  'segments',
  'personas',
  'marketSize',
  'competitors',
  'trends',
  'insights',
  'solution',
  'steps',
  'experiments',
  'hypotheses',
  'scenarios',
  'assumptions',
  'constraints',
  'weaknesses',
  'strengths',
  'stopFactors',
  'risks',
  'blockers',
  'nextSteps',
  'reasoning',
  'overallScore',
  'confidence',
  'recommendation',
  'value',
  'effect',
  'quality',
  'formula',
  'params',
  'notes',
  'description',
  'name',
  'severity',
  'priority',
]

/** Поля, которые уже вынесены в заголовок блока — не повторяем строкой. */
const HEADING_KEYS = new Set(['name', 'title'])

function canonicalKeys(obj: Record<string, unknown>): string[] {
  const rank = (k: string) => {
    const i = FIELD_ORDER.indexOf(k)
    return i === -1 ? FIELD_ORDER.length + 1 : i
  }
  return Object.keys(obj).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'ru'))
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function scalarText(v: unknown): string {
  if (v === null || v === undefined) {
    return '—'
  }
  if (typeof v === 'number') {
    if (Number.isInteger(v)) {
      return String(v)
    }
    return v.toFixed(2).replace(/\.?0+$/, '')
  }
  if (typeof v === 'boolean') {
    return v ? 'да' : 'нет'
  }
  return fieldValueLabel(String(v).trim())
}

/**
 * Один узел jsonb → блоки. Заголовок раздела публикуется только если внутри
 * что-то есть: пустые `## Ограничения` без содержимого выглядят как поломка.
 */
function renderValue(key: string, value: unknown, depth: number, out: MaterialBlock[]): void {
  const label = fieldLabel(key)

  if (value === null || value === undefined || value === '') {
    return
  }

  if (Array.isArray(value)) {
    const own: MaterialBlock[] = []
    const primitives = value.every(v => !isPlainObject(v) && !Array.isArray(v))
    if (primitives) {
      for (const item of value) {
        const text = scalarText(item)
        if (text && text !== '—') {
          own.push({ text, type: 'li' })
        }
      }
    }
    else {
      value.forEach((item, i) => {
        if (isPlainObject(item)) {
          const heading = scalarText(item.name ?? item.title ?? '') || `${label} ${i + 1}`
          own.push({ level: 3, text: heading, type: 'h' })
          for (const k of canonicalKeys(item)) {
            if (!HEADING_KEYS.has(k)) {
              renderValue(k, item[k], depth + 2, own)
            }
          }
        }
        else {
          own.push({ text: scalarText(item), type: 'li' })
        }
      })
    }
    emitSection(label, own, depth, out)
    return
  }

  if (isPlainObject(value)) {
    const own: MaterialBlock[] = []
    for (const k of canonicalKeys(value)) {
      renderValue(k, value[k], depth + 1, own)
    }
    emitSection(label, own, depth, out)
    return
  }

  out.push({ text: `${label}: ${scalarText(value)}`, type: 'p' })
}

function emitSection(label: string, own: MaterialBlock[], depth: number, out: MaterialBlock[]): void {
  if (own.length === 0) {
    return
  }
  out.push({ level: depth === 0 ? 2 : 3, text: label, type: 'h' }, ...own)
}

function formatTime(iso: null | string | undefined): string {
  if (!iso) {
    return '—'
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return String(iso)
  }
  return `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/** Markdown из блоков — для скачивания .md и для текста в отчёте. */
export function blocksToMarkdown(blocks: readonly MaterialBlock[]): string {
  return blocks.map((b) => {
    if (b.type === 'h') {
      return `${'#'.repeat(b.level)} ${b.text}`
    }
    if (b.type === 'li') {
      return `- ${b.text}`
    }
    if (b.type === 'pre') {
      return ['```', b.text, '```'].join('\n')
    }
    return b.text
  }).join('\n\n')
}

/**
 * Собирает материалы фазы. Формат заголовка зафиксирован ТЗ:
 * `# Материалы: <человеческое название фазы>` → `## Что сделано` → `## Контекст`.
 */
export function buildMaterials(input: MaterialsInput): { blocks: MaterialBlock[], markdown: string } {
  const title = phaseTitle(input.role, 'Этап работы')
  const blocks: MaterialBlock[] = [{ level: 1, text: `Материалы: ${title}`, type: 'h' }]

  const data = isPlainObject(input.value) ? (input.value.data ?? input.value) : input.value

  blocks.push({ level: 2, text: 'Что сделано', type: 'h' })
  if (typeof data === 'string') {
    blocks.push({ text: data, type: 'p' })
  }
  else if (isPlainObject(data)) {
    const keys = canonicalKeys(data)
    if (keys.length === 0) {
      blocks.push({ text: 'Фаза не вернула содержательных полей.', type: 'p' })
    }
    for (const k of keys) {
      renderValue(k, data[k], 0, blocks)
    }
  }
  else {
    blocks.push({ text: JSON.stringify(data, null, 2), type: 'pre' })
  }

  blocks.push({ level: 2, text: 'Контекст', type: 'h' })
  blocks.push({ text: `Фаза: ${title}`, type: 'p' })
  blocks.push({ text: `Техническая роль: ${input.role}`, type: 'p' })
  if (input.startedAt) {
    blocks.push({ text: `Начало: ${formatTime(input.startedAt)}`, type: 'p' })
  }
  blocks.push({ text: `Завершено: ${formatTime(input.finishedAt)}`, type: 'p' })
  if (input.durationMs !== undefined) {
    blocks.push({ text: `Длительность: ${(input.durationMs / 1000).toFixed(1)} с`, type: 'p' })
  }

  const metadata = isPlainObject(input.value) ? input.value.metadata : undefined
  if (isPlainObject(metadata) && Object.keys(metadata).length > 0) {
    blocks.push({ level: 2, text: 'Техническое приложение', type: 'h' })
    for (const k of canonicalKeys(metadata)) {
      const v = metadata[k]
      if (!isPlainObject(v) && !Array.isArray(v)) {
        blocks.push({ text: `${fieldLabel(k)}: ${scalarText(v)}`, type: 'p' })
      }
    }
  }

  return { blocks, markdown: blocksToMarkdown(blocks) }
}
