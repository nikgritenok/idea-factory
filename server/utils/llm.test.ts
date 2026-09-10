import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { callLlm, callLlmText, LlmError } from './llm'

const originalEnv = process.env

beforeEach(() => {
  vi.resetModules()
  process.env = { ...originalEnv }
  process.env.ROUTERAI_API_KEY = process.env.ROUTERAI_API_KEY
})

afterEach(() => {
  process.env = originalEnv
  vi.unstubAllGlobals()
})

const TestSchema = z.object({ title: z.string() })

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    json: async () => await Promise.resolve(body),
    ok,
    status,
    text: async () => await Promise.resolve(JSON.stringify(body)),
  }
}

describe('LLM клиент', () => {
  describe('callLlm', () => {
    it('вызывает LLM и валидирует ответ через Zod-схему', async () => {
      const mockResponse = {
        choices: [{ message: { content: '{"title":"Тест"}' } }],
        usage: { completion_tokens: 10, prompt_tokens: 20, total_tokens: 30 },
      }
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse(mockResponse)))

      const result = await callLlm(TestSchema, {
        system: 'Ты аналитик',
        user: 'Опиши идею',
      })

      expect(result.data).toEqual({ title: 'Тест' })
      expect(result.usage?.totalTokens).toBe(30)
    })

    it('выбрасывает ошибку если API ключ не настроен', async () => {
      delete process.env.ROUTERAI_API_KEY

      await expect(callLlm(TestSchema, { system: 'Тест', user: 'Тест' })).rejects.toThrow(LlmError)
    })

    it('выбрасывает ошибку при HTTP ошибке API', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({}, false, 401)))

      await expect(callLlm(TestSchema, { system: 'Тест', user: 'Тест' })).rejects.toThrow(LlmError)
    })

    it('выбрасывает ошибку при невалидном JSON от модели', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({
        choices: [{ message: { content: 'не JSON ответ' } }],
      })))

      await expect(callLlm(TestSchema, { system: 'Тест', user: 'Тест' })).rejects.toThrow('некорректный JSON')
    })

    it('выбрасывает ошибку при невалидном формате ответа', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({
        choices: [{ message: { content: '{"invalid": true}' } }],
      })))

      await expect(callLlm(TestSchema, { system: 'Тест', user: 'Тест' })).rejects.toThrow('невалидный формат')
    })

    it('парсит JSON из markdown-блока ```json', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({
        choices: [{ message: { content: '```json\n{"title":"Тест"}\n```' } }],
      })))

      const result = await callLlm(TestSchema, { system: 'Тест', user: 'Тест' })
      expect(result.data).toEqual({ title: 'Тест' })
    })
  })

  describe('callLlmText', () => {
    it('возвращает сырой текст без валидации', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse({
        choices: [{ message: { content: 'Простой текст ответа' } }],
      })))

      const result = await callLlmText({ system: 'Тест', user: 'Тест' })
      expect(result.text).toBe('Простой текст ответа')
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
