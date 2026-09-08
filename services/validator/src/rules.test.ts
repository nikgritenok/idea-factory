import { describe, expect, it } from 'vitest'

import { validateRules } from './rules'
import type { ValidateRequest } from './types'

describe('Валидатор правил', () => {
  it('валидные данные проходят проверку', () => {
    const input: ValidateRequest = {
      category: 'вопрос',
      priority: 'medium',
      responsibleDepartment: 'Поддержка',
    }
    const result = validateRules(input)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('жалоба с приоритетом low — ошибка', () => {
    const input: ValidateRequest = {
      category: 'жалоба',
      priority: 'low',
      responsibleDepartment: 'Поддержка',
    }
    const result = validateRules(input)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Для жалобы приоритет не может быть low')
  })

  it('жалоба с приоритетом medium — ОК', () => {
    const input: ValidateRequest = {
      category: 'жалоба',
      priority: 'medium',
      responsibleDepartment: 'Поддержка',
    }
    const result = validateRules(input)
    expect(result.valid).toBe(true)
  })

  it('жалоба с приоритетом high — ОК', () => {
    const input: ValidateRequest = {
      category: 'жалоба',
      priority: 'high',
      responsibleDepartment: 'Поддержка',
    }
    const result = validateRules(input)
    expect(result.valid).toBe(true)
  })

  it('приоритет high без отдела — предупреждение', () => {
    const input: ValidateRequest = {
      category: 'вопрос',
      priority: 'high',
      responsibleDepartment: '',
    }
    const result = validateRules(input)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Для приоритета high рекомендуется указать ответственный отдел')
  })

  it('все категории работают', () => {
    const categories = ['вопрос', 'жалоба', 'запрос', 'предложение'] as const
    for (const category of categories) {
      const input: ValidateRequest = {
        category,
        priority: 'medium',
        responsibleDepartment: 'Поддержка',
      }
      const result = validateRules(input)
      expect(result.valid).toBe(true)
    }
  })

  it('все приоритеты работают', () => {
    const priorities = ['low', 'medium', 'high'] as const
    for (const priority of priorities) {
      const input: ValidateRequest = {
        category: 'вопрос',
        priority,
        responsibleDepartment: 'Поддержка',
      }
      const result = validateRules(input)
      expect(result.valid).toBe(true)
    }
  })
})
