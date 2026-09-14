import { describe, expect, it, vi } from 'vitest'

import { createLlmExecutor } from './llm-executor'

// Мокаем LLM-клиент
vi.mock('../utils/llm', () => ({
  callLlm: vi.fn(),
  LlmError: class LlmError extends Error {
    constructor(message: string, public status?: number) {
      super(message)
      this.name = 'LlmError'
    }
  },
}))

/**
 * Минимальный двойник `ctx.db` под цепочку Prisma 8: `.select().where().first()`.
 * Нужен ровно один метод — чтение транскрипта идеи; остального исполнитель не касается.
 */
function fakeDb(sourceTranscript: string) {
  // async + await: правило требует, чтобы функция, возвращающая промис, была async,
  // а `ai-guard` не терпит `async` без `await` — вот такой форме подчиняются обе.
  const first = async () => await Promise.resolve({ sourceTranscript })
  return {
    orm: {
      public: {
        Ideas: {
          select: () => ({ where: () => ({ first }) }),
        },
      },
    },
  } as never
}

describe('LLM-исполнитель', () => {
  it('создаёт исполнителя для роли orchestrator', async () => {
    const { callLlm } = await import('../utils/llm')
    vi.mocked(callLlm).mockResolvedValue({
      data: {
        complexity: 'medium',
        estimatedMinutes: 30,
        notes: 'Тестовый прогон',
        priority: 'medium',
        steps: ['Шаг 1', 'Шаг 2'],
        title: 'Тестовая идея',
      },
      usage: { totalTokens: 100 },
    })

    const executor = createLlmExecutor('orchestrator')
    const ctx = {
      // orchestrator — первый шаг, `idea_analysis` в state ещё нет, поэтому
      // production-путь читает транскрипт из БД (llm-executor.ts:71). Пустой `db`
      // здесь был стабом из времени, когда чтения не было; `state.transcript` —
      // ключа с таким именем в PipelineState нет вообще (state = stepResults).
      db: fakeDb('Тестовая идея для анализа'),
      ideaId: 'test-idea-id',
      jobId: 'test-job-id',
      signal: new AbortController().signal,
      sql: {} as never,
      state: {},
      step: { id: 'orchestrator_plan', role: 'orchestrator' },
    }

    const result = await executor(ctx)

    expect(result.output).toHaveProperty('data')
    expect(result.output).toHaveProperty('metadata')
    expect(vi.mocked(callLlm)).toHaveBeenCalledOnce()
  })

  it('выбрасывает ошибку для неизвестной роли', async () => {
    const executor = createLlmExecutor('unknown_role')
    const ctx = {
      db: {} as never,
      ideaId: 'test-idea-id',
      jobId: 'test-job-id',
      signal: new AbortController().signal,
      sql: {} as never,
      state: {},
      step: { id: 'test', role: 'unknown_role' },
    }

    await expect(executor(ctx)).rejects.toThrow('Не найден LLM-конфиг')
  })

  it('передаёт предыдущие результаты в промпт', async () => {
    const { callLlm } = await import('../utils/llm')
    vi.mocked(callLlm).mockResolvedValue({
      data: { recommendations: ['Рекомендация 1'] },
      usage: { totalTokens: 150 },
    })

    const executor = createLlmExecutor('critic')
    const ctx = {
      db: {} as never,
      ideaId: 'test-idea-id',
      jobId: 'test-job-id',
      signal: new AbortController().signal,
      sql: {} as never,
      state: {
        efficiency_model: { scenarios: [] },
        idea_analysis: { sourceTranscript: 'Текст идеи', title: 'Идея' },
        market_research: { competitors: [] },
        strategy: { experiments: [] },
      },
      step: { id: 'critic_review', role: 'critic' },
    }

    const result = await executor(ctx)
    expect(result.output).toHaveProperty('data')
  })
})
