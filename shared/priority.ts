// Семантический порядок приоритетов (high → medium → low).
// Живёт в shared без зависимостей: используется и сервером, и чистыми юнит-тестами
// (vitest не резолвит `~~`-алиас, поэтому модуль не должен тянуть db или схемы).
// Нужен, потому что `priority` — текстовая колонка БД, и сортировка по ней даёт
// алфавит (high, low, medium), хороня medium под low.

const PRIORITY_RANK: Record<string, number> = { high: 0, low: 2, medium: 1 }

function rankOf(priority: string): number {
  return PRIORITY_RANK[priority] ?? 99
}

export interface PrioritizedRow {
  createdAt: string
  id: string
  priority: string
}

/** high → medium → low; внутри одного приоритета — сначала новые; тай-брейк по id. */
export function compareIdeasByPriority(a: PrioritizedRow, b: PrioritizedRow): number {
  const byRank = rankOf(a.priority) - rankOf(b.priority)
  if (byRank !== 0) return byRank
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}
