import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Страж правила «violations are bugs» из AGENTS.md: до шага 18 оно держалось только на
// тексте в документации и ровно поэтому разошлось с кодом (apiError не вызывался нигде).
// Роуты читаем как текст — не импортируем их (иначе потянули бы Nitro и БД).

const ROOTS = [
  join(import.meta.dirname, '../api'),
  join(import.meta.dirname, '../routes'),
]

function routeFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...routeFiles(full))
    }
    else if (entry.name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

const sources = new Map(
  ROOTS.flatMap(routeFiles).map(file => [
    file,
    readFileSync(file, 'utf8'),
  ] as const),
)

/** Вырезает аргумент каждого `createError({ … })` по балансу фигурных скобок */
function createErrorBlocks(source: string): string[] {
  const blocks: string[] = []
  const marker = 'createError('

  let from = 0
  let hit = source.indexOf(marker, from)
  while (hit !== -1) {
    const open = source.indexOf('{', hit)
    if (open === -1) break

    let depth = 0
    let end = open
    while (end < source.length) {
      const ch = source[end]
      if (ch === '{') {
        depth++
      }
      else if (ch === '}') {
        depth--
        if (depth === 0) break
      }
      end++
    }

    blocks.push(source.slice(open, end + 1))
    from = end + 1
    hit = source.indexOf(marker, from)
  }

  return blocks
}

// Ключ мог быть записан явно (`code: …`) или шортхендом (`code,`) — eslint как раз требует
// второго варианта, когда имя совпадает с переменной. Литералы вместо new RegExp — правило
// security/detect-non-literal-regexp.
const KEY_PATTERNS = {
  code: /(^|[{,\s])code\s*[:,\n}]/u,
  fix: /(^|[{,\s])fix\s*[:,\n}]/u,
  status: /(^|[{,\s])status\s*[:,\n}]/u,
  why: /(^|[{,\s])why\s*[:,\n}]/u,
} as const

const REQUIRED_KEYS = Object.keys(KEY_PATTERNS) as (keyof typeof KEY_PATTERNS)[]

describe('конвенция ошибок API (server/api, server/routes)', () => {
  it('роуты найдены — иначе страж ничего не проверяет', () => {
    expect(sources.size).toBeGreaterThan(20)
  })

  it('каждый createError несёт code, status, why и fix', () => {
    for (const [file, source] of sources) {
      for (const block of createErrorBlocks(source)) {
        for (const key of REQUIRED_KEYS) {
          expect(KEY_PATTERNS[key].test(block), `${file}: в createError нет поля ${key}`).toBe(true)
        }
      }
    }
  })

  it('роут, который кидает createError, импортирует его из evlog', () => {
    // Авто-импорт createError в Nitro — это h3-версия, она теряет why/fix/link
    const importsFromEvlog = /^import \{[^}]*createError[^}]*\} from 'evlog'/gmu

    for (const [file, source] of sources) {
      if (source.includes('createError(')) {
        importsFromEvlog.lastIndex = 0
        expect(importsFromEvlog.test(source), file).toBe(true)
      }
    }
  })

  it('в роутах не осталось сырых h3-ошибок со statusMessage', () => {
    const h3StatusMessage = /statusMessage:/u

    for (const [file, source] of sources) {
      expect(h3StatusMessage.test(source), file).toBe(false)
    }
  })
})
