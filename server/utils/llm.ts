import type { z } from 'zod'

const ROUTERAI_BASE = 'https://routerai.ru/api/v1'
export const LLM_MODEL = 'z-ai/glm-5.3-flash'

export interface LlmCallOptions {
  /** Максимум токенов в ответе (по умолчанию 4096) */
  maxTokens?: number
  /** Шаг пайплайна (для трейсинга) */
  step?: string
  /** System prompt — роль и границы */
  system: string
  /** Температура (0.0–2.0, по умолчанию 0.3) */
  temperature?: number
  /** Таймаут запроса в мс (по умолчанию 60000) */
  timeoutMs?: number
  /** User prompt — задача с входными данными */
  user: string
}

export interface LlmCallResult<T> {
  /** Стоимость запроса (в рублях) */
  cost?: number
  /** Распарсенный и валидированный ответ */
  data: T
  /** Количество использованных токенов */
  usage?: { completionTokens?: number, promptTokens?: number, totalTokens?: number }
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

/**
 * Вызов LLM через routerai.ru (OpenAI-compatible /v1/chat/completions).
 * Возвращает сырой текст ответа модели.
 */
async function callLlmRaw(options: LlmCallOptions): Promise<{ text: string, usage?: LlmCallResult<unknown>['usage'], cost?: number }> {
  const apiKey = process.env.ROUTERAI_API_KEY
  if (!apiKey) {
    throw new LlmError('LLM-ключ не настроен на сервере', 503)
  }

  const body = {
    max_tokens: options.maxTokens ?? 4096,
    messages: [
      { content: options.system, role: 'system' },
      { content: options.user, role: 'user' },
    ],
    model: LLM_MODEL,
    // Строгий JSON-режим: модель ОБЯЗАНА вернуть JSON по схеме из system prompt
    response_format: { type: 'json_object' },
    structured_outputs: true,
    temperature: options.temperature ?? 0.3,
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, options.timeoutMs ?? 300_000)

  const startTime = Date.now()
  let res: Response
  try {
    res = await fetch(`${ROUTERAI_BASE}/chat/completions`, {
      body: JSON.stringify(body),
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: controller.signal,
    })
  }
  catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmError('LLM-запрос превысил таймаут', 504)
    }
    throw new LlmError('Сервис LLM недоступен', 502, error)
  }
  finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new LlmError(`Ошибка LLM (HTTP ${res.status}): ${text}`, res.status)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { completion_tokens?: number, prompt_tokens?: number, total_tokens?: number }
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new LlmError('LLM вернул пустой ответ')
  }

  const durationMs = Date.now() - startTime
  const usage = {
    completionTokens: data.usage?.completion_tokens,
    promptTokens: data.usage?.prompt_tokens,
    totalTokens: data.usage?.total_tokens,
  }

  // Логируем метрики вызова (для LangSmith трейсинга через LangGraph)
  if (process.env.LANGSMITH_TRACING === 'true') {
    console.log(JSON.stringify({
      durationMs,
      event: 'llm_call',
      model: LLM_MODEL,
      step: options.step,
      temperature: options.temperature ?? 0.3,
      tokens: usage.totalTokens,
    }))
  }

  return {
    cost: 0, // routerai.ru не всегда возвращает стоимость
    text: content.trim(),
    usage,
  }
}

/**
 * Вызов LLM с валидацией ответа через Zod-схему.
 * Парсит JSON из ответа модели и валидирует структуру.
 */
export async function callLlm<T>(
  schema: z.ZodType<T>,
  options: LlmCallOptions,
): Promise<LlmCallResult<T>> {
  const raw = await callLlmRaw(options)

  // Попытка распарсить JSON из ответа модели
  let parsed: unknown
  try {
    // Модель может вернуть JSON в markdown-блоке ```json ... ```
    const jsonMatch = raw.text.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonString = jsonMatch?.[1] ?? raw.text
    parsed = JSON.parse(jsonString.trim())
  }
  catch {
    // Диагностика: показываем начало сырого ответа (обрыв по maxTokens и т.п.)
    const head = raw.text.slice(0, 120).replaceAll('\n', ' ')
    throw new LlmError(`LLM вернул некорректный JSON (начало ответа: «${head}…», длина ${raw.text.length})`)
  }

  // Валидация через Zod
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new LlmError(`LLM вернул невалидный формат: ${result.error.message}`)
  }

  return {
    cost: raw.cost,
    data: result.data,
    usage: raw.usage,
  }
}

/**
 * Простой вызов LLM без валидации (для случаев, когда нужен сырой текст).
 */
export async function callLlmText(options: LlmCallOptions): Promise<{ text: string, usage?: LlmCallResult<unknown>['usage'] }> {
  const raw = await callLlmRaw(options)
  return { text: raw.text, usage: raw.usage }
}
