import type { ValidateRequest, ValidateResponse } from './types'

/**
 * Правила валидации (TZ §1).
 * Проверяет согласованность полей после базовой валидации Zod.
 */

/**
 * Проверяет согласованность правил.
 * Базовые проверки (обязательные поля, допустимые значения) — на уровне Zod-схемы.
 * Здесь — бизнес-правила.
 */
export function validateRules(data: ValidateRequest): ValidateResponse {
  const errors: string[] = []

  // Правило 1: категория "жалоба" → приоритет не ниже medium
  if (data.category === 'жалоба' && data.priority === 'low') {
    errors.push('Для жалобы приоритет не может быть low')
  }

  // Правило 2: категория "запрос" → обязателен ответственный отдел
  if (data.category === 'запрос' && !data.responsibleDepartment.trim()) {
    errors.push('Для запроса обязателен ответственный отдел')
  }

  // Правило 3: приоритет high → рекомендуется указать отдел
  if (data.priority === 'high' && !data.responsibleDepartment.trim()) {
    errors.push('Для приоритета high рекомендуется указать ответственный отдел')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
