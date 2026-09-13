import { createError } from 'evlog'
import { describe, expect, it } from 'vitest'

import { extractApiMessage } from './types'

// Так приходит ответ error-handler'а evlog: $fetch кладёт разобранное тело в err.data
function fetchError(body: unknown, fetchMessage = 'Failed'): unknown {
  return { data: body, message: fetchMessage }
}

describe('extractApiMessage', () => {
  it('читает message из evlog-ответа (регресс: раньше всегда проваливалось в заглушку)', () => {
    const body = {
      data: { code: 'IDEA_NOT_FOUND', fix: 'Вернитесь на доску', why: 'Нет строки с id=…' },
      message: 'Идея не найдена',
      statusCode: 404,
      statusMessage: 'Идея не найдена',
      url: '/api/ideas/x',
    }

    expect(extractApiMessage(fetchError(body))).toBe('Идея не найдена')
  })

  it('понимает EvlogError, не прошедший через HTTP', () => {
    const err = createError({
      code: 'IDEA_LIMIT_REACHED',
      fix: 'Заархивируйте идею',
      message: 'Достигнут лимит 10 активных идей',
      status: 409,
      why: 'Активных идей 10',
    })

    expect(extractApiMessage(err)).toBe('Достигнут лимит 10 активных идей')
  })

  it('держит и старый вид h3-ответа (statusMessage без data)', () => {
    const body = { statusCode: 404, statusMessage: 'Задача не найдена' }

    expect(extractApiMessage(fetchError(body))).toBe('Задача не найдена')
  })

  it('не выдумывает сообщение: у пустой ошибки остаётся заглушка', () => {
    expect(extractApiMessage(new Error(''))).toBe('Неизвестная ошибка')
    expect(extractApiMessage(undefined)).toBe('Неизвестная ошибка')
  })
})
