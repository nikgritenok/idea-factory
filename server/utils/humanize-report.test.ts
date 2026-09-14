import { describe, expect, it } from 'vitest'

import { humanizeReportText } from './humanize-report'

describe('приведение прозы агентов к читаемому виду', () => {
  const text = (input: unknown) => humanizeReportText(input) as string

  it('числа единиц — с запятой, как весь отчёт', () => {
    expect(text('Расчёт эффекта (3.57 мин экономии)')).toContain('3,57 мин')
    expect(text('качество 0.92 выше порога')).toContain('0,92')
  })

  it('версию не портим, обычное десятичное — приводим', () => {
    expect(text('сборка 2.5.1 и 12.4 млн')).toContain('2.5.1')
    expect(text('сборка 2.5.1 и 12.4 млн')).toContain('12,4 млн')
  })

  it('сырые имена полей расчёта заменяются русскими подписями', () => {
    const out = text('База (meanMinutes ~6 мин, rowCount 200)')
    expect(out).toContain('Среднее время, мин')
    expect(out).toContain('Строк в выборке')
    expect(out).not.toContain('rowCount')
  })

  it('пробеваем массивы и вложенные объекты секций', () => {
    const out = humanizeReportText({
      nested: { note: 'эффект 4.25 мин' },
      steps: ['проверить 3.1 мин', 'ещё'],
    }) as { nested: { note: string }, steps: string[] }
    expect(out.nested.note).toContain('4,25 мин')
    expect(out.steps[0]).toContain('3,1 мин')
  })

  it('не строковые значения проходят как есть', () => {
    expect(humanizeReportText(null)).toBeNull()
    expect(humanizeReportText(7)).toBe(7)
    expect(humanizeReportText(true)).toBe(true)
  })
})
