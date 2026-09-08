import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LlmCallOptions } from './llm'

import { callLlm, callLlmText, LlmError } from './llm'

// Мокаем process.env
const originalEnv = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
  process.env.ROUTERAI_API_KEY = 'test-api-key'
})

afterEach(() => {
  process.env = originalEnv
})

describe('LLM клиент', () => {
  describe('callLlm', () => {
    it('вызывает LLM и валидирует ответ через Zod-схему', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"title":"Тест","value":"Описание"}' } }],
        usage: { completion_tokens: 10, prompt_tokens: 20, total_tokens: 30 },
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
        ok: true,
      }))

      const schema = {
        safeParse: (data: unknown) => {
          if (typeof data === 'object' && data !== null && 'title' in data) {
            return { success: true, data }
          }
          return { success: false, error: { message: 'Invalid' } }
        },
      }

      const result = await callLlm(schema as Parameters<typeof callLlm>[0], {
        system: 'Ты аналитик',
        user: 'Опиши идею',
      })

      expect(result.data).toEqual({ title: 'Тест', value: 'Описание' })
      expect(result.usage?.totalTokens).toBe(30)
      vi.mocked(fetch).mockRestore()
    })

    it('выбрасывает ошибку если API ключ не настроен', async () => {
      delete process.env.ROUTERAI_API_KEY

      await expect(callLlm(
        { safeParse: () => ({ success: true, data: {} }) } as Parameters<typeof callLlm>[0],
        { system: 'Тест', user: 'Тест' },
      )).rejects.toThrow(LlmError)
    })

    it('выбрасывает ошибку при HTTP ошибке API', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({}),
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }))

      await expect(callLlm(
        { safeParse: () => ({ success: true, data: {} }) } as Parameters<typeof callLlm>[0],
        { system: 'Тест', user: 'Тест' },
      )).rejects.toThrow(LlmError)

      vi.mocked(fetch).mockRestore()
    })

    it('выбрасывает ошибку при невалидном JSON от модели', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [{ message: { content: 'не JSON ответ' } }],
        }),
        ok: true,
      }))

      await expect(callLlm(
        { safeParse: () => ({ success: true, data: {} }) } as Parameters<typeof callLlm>[0],
        { system: 'Тест', user: 'Тест' },
      )).rejects.toThrow('некорректный JSON')

      vi.mocked(fetch).mockRestore()
    })

    it('выбрасывает ошибку при невалидном формате ответа', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [{ message: { content: '{"invalid": true}' } }],
        }),
        ok: true,
      }))

      const schema = {
        safeParse: () => ({ success: false, error: { message: 'Missing title' } }),
      }

      await expect(callLlm(
        schema as Parameters<typeof callLlm>[0],
        { system: 'Тест', user: 'Тест' },
      )).rejects.toThrow('невалидный формат')

      vi.mocked(fetch).mockRestore()
    })

    it('парсит JSON из markdown-блока ```json', async () => {
      const jsonContent = '{"title":"Тест"}'
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [{ message: { content: `\`\`\`json\n${jsonContent}\n\`\`\`` } }],
        }),
        ok: true,
      }))

      const schema = {
        safeParse: (data: unknown) => ({ success: true, data }),
      }

      const result = await callLlm(schema as Parameters<typeof callLlm>[0], {
        system: 'Тест',
        user: 'Тест',
      })

      expect(result.data).toEqual({ title: 'Тест' })
      vi.mocked(fetch).mockRestore()
    })
  })

  describe('callLlmText', () => {
    it('возвращает сырой текст без валидации', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Простой текст ответа' } }],
        }),
        ok: true,
      }))

      const result = await callLlmText({
        system: 'Тест',
        user: 'Тест',
      })

      expect(result.text).toBe('Простой текст ответа')
      vi.mocked(fetch).mockRestore()
    })
  })

  describe('LlmError', () => {
    it('содержит message, status и name', () => {
      const error = new LlmError('Test error', 500)
      expect(error.message).toBe('Test error')
      expect(error.status).toBe(500)
      expect(error.name).toBe('LlmError')
    })
  })
})
