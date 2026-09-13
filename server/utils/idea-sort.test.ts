import { describe, expect, it } from 'vitest'

import type { PrioritizedRow } from '../../shared/priority'

import { compareIdeasByPriority } from '../../shared/priority'

function row(overrides: Partial<PrioritizedRow> = {}): PrioritizedRow {
  return {
    createdAt: '2026-09-14T10:00:00.000Z',
    id: '00000000-0000-0000-0000-000000000000',
    priority: 'medium',
    ...overrides,
  }
}

function sortedPriorities(rows: PrioritizedRow[]): string[] {
  return [...rows].sort(compareIdeasByPriority).map(r => r.priority)
}

describe('compareIdeasByPriority', () => {
  it('high → medium → low независимо от входного порядка (регресс: БД сортировала по алфавиту)', () => {
    const rows = [
      row({ id: '3', priority: 'low' }),
      row({ id: '1', priority: 'medium' }),
      row({ id: '2', priority: 'high' }),
    ]

    expect(sortedPriorities(rows)).toEqual(['high', 'medium', 'low'])
  })

  it('внутри приоритета — сначала новые', () => {
    const rows = [
      row({ createdAt: '2026-09-10T10:00:00.000Z', priority: 'high' }),
      row({ createdAt: '2026-09-14T10:00:00.000Z', priority: 'high' }),
    ]

    const sorted = [...rows].sort(compareIdeasByPriority)
    expect(sorted[0]?.createdAt).toBe('2026-09-14T10:00:00.000Z')
  })

  it('неизвестный приоритет уходит в конец, а не в середину', () => {
    expect(sortedPriorities([
      row({ priority: 'low' }),
      row({ priority: 'urgent' }),
      row({ priority: 'high' }),
    ])).toEqual(['high', 'low', 'urgent'])
  })

  it('полные совпадения стабильны по id', () => {
    const rows = [
      row({ id: 'b' }),
      row({ id: 'a' }),
    ]

    const sorted = [...rows].sort(compareIdeasByPriority)
    expect(sorted.map(r => r.id)).toEqual(['a', 'b'])
  })
})
