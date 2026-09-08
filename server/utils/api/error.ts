// Единый API error helper (TZ §11).
// Все API-ошибки бросаются через apiError() — единый формат envelope для клиента.

import type { H3Error } from 'h3'

export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Бросает API-ошибку в стандартном формате.
 * evlog автоматически логирует ошибку через middleware (wide event per request).
 *
 * @param status HTTP status code
 * @param code   Machine-readable error code (UPPER_SNAKE_CASE)
 * @param message Human-readable message ( safe для показа клиенту )
 * @param details Optional additional context (validation errors, etc.)
 *
 * @example
 * throw apiError(404, 'IDEA_NOT_FOUND', 'Идея не найдена')
 * throw apiError(409, 'IDEA_LIMIT_REACHED', 'Достигнут лимит 10 активных идей', { activeCount: 10 })
 * throw apiError(400, 'VALIDATION_ERROR', 'Некорректные данные', zodError.flatten())
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): never {
  throw createError({
    data: {
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    } satisfies ApiErrorBody,
    statusCode: status,
  })
}

/**
 * Обработка ошибок из нижних слоёв (сервисы, БД, внешние API).
 * Преобразует известные типы ошибок в apiError, остальное — пробрасывает дальше.
 *
 * @example
 * try {
 *   const job = await cancelJob(sql, jobId)
 *   return { job }
 * } catch (error) {
 *   throw fromServiceError(error)
 * }
 */
export function fromServiceError(error: unknown): never {
  if (error && typeof error === 'object' && 'statusCode' in error && 'message' in error) {
    const h3Err = error as H3Error
    throw createError({
      statusCode: h3Err.statusCode,
      statusMessage: h3Err.statusMessage ?? h3Err.message,
    })
  }
  throw error
}
