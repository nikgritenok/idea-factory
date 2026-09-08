import { z } from 'zod'

/**
 * Схемы валидатора правил (TZ §1).
 * Проверяет: обязательные поля, допустимые значения, согласованность.
 */

export const CategorySchema = z.enum(['вопрос', 'жалоба', 'запрос', 'предложение'])
export type Category = z.infer<typeof CategorySchema>

export const PrioritySchema = z.enum(['low', 'medium', 'high'])
export type Priority = z.infer<typeof PrioritySchema>

export const ValidateRequestSchema = z.object({
  category: CategorySchema,
  priority: PrioritySchema,
  responsibleDepartment: z.string().min(1, 'Ответственный отдел обязателен'),
})
export type ValidateRequest = z.infer<typeof ValidateRequestSchema>

export interface ValidateResponse {
  valid: boolean
  errors: string[]
}

export interface VersionResponse {
  version: string
}
