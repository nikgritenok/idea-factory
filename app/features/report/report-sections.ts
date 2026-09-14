interface Weakness { description?: null | string, mitigation?: null | string, severity?: null | string }

export interface ReportSection {
  content: unknown
  key: string
  title: string
}

export function toObjectList(value: unknown): Record<string, unknown>[] {
  if (!value) return []
  const list: unknown[] = Array.isArray(value) ? value : Object.values(value)
  return list.filter((item): item is Record<string, unknown> =>
    typeof item === 'object' && item !== null,
  )
}

export function weaknesses(sections: ReportSection[]): Weakness[] {
  return toObjectList(
    sections.find(section => section.key === 'weaknesses')?.content
    ?? sections.find(section => section.title === 'Слабые места')?.content,
  )
}

export const RECOMMENDATION_LABELS: Record<string, string> = {
  develop: 'Развивать',
  insufficient_data: 'Недостаточно данных',
  postpone: 'Отложить',
  reject: 'Отклонить',
  validate_first: 'Сначала провалидировать',
}

// Человеческие имена фаз живут в shared/phase-names (единственный источник):
// локальный словарь ROLE_LABELS здесь только плодил второй вариант подписи.

export function nextSteps(sections: ReportSection[]): string[] {
  const content = sections.find(section => section.key === 'nextSteps')?.content
    ?? sections.find(section => section.title === 'Следующие шаги')?.content
  if (!content) return []
  if (typeof content === 'string') {
    try {
      const parsed: unknown = JSON.parse(content)
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [content]
    }
    catch {
      return content.split('\n').map(line => line.trim()).filter(Boolean)
    }
  }
  if (Array.isArray(content)) {
    return content.filter((s): s is string => typeof s === 'string')
  }
  return []
}
