import type { StepContext, StepResult } from './types'

import { getRoleConfig } from '../../config/roles'
import { callLlm, LlmError } from '../utils/llm'
import { withRunCall } from './run-protocol'

/**
 * LLM-исполнитель шагов пайплайна.
 * Вызывает реальный LLM (z-ai/glm-5.3-flash) с валидацией ответа.
 * Записывает каждый вызов в run_calls через протокол прогона (TZ §9).
 *
 * Паттерн: role ID из pipeline.ts → конфиг роли → промпт → LLM → Zod-валидация → результат.
 * Битый ответ модели → LlmError → retry (если retries > 0).
 */

interface LlmExecutorContext extends StepContext {
  /** Дополнительные данные для промпта (например, результаты предыдущих шагов) */
  promptData?: Record<string, unknown>
}

/**
 * Формирует user prompt на основе роли и входных данных.
 * Каждая роль имеет свой шаблон промпта.
 */
function buildUserPrompt(stepId: string, ideaTranscript: string, previousResults: Record<string, unknown>): string {
  const role = getRoleConfig(stepId)
  if (!role || !('user' in role)) {
    throw new Error(`Не найден конфиг роли для шага: ${stepId}`)
  }

  // Роли с кастомными промптами
  switch (stepId) {
    case 'orchestrator':
      return (role as { user: (idea: string) => string }).user(ideaTranscript)
    case 'idea_analyst':
      return (role as { user: (transcript: string) => string }).user(ideaTranscript)
    case 'market_analyst':
      return (role as { user: (idea: string) => string }).user(ideaTranscript)
    case 'strategist': {
      const marketData = JSON.stringify(previousResults.market_research ?? {}, null, 2)
      return (role as { user: (idea: string, market: string) => string }).user(ideaTranscript, marketData)
    }
    case 'efficiency_analyst': {
      const baselineData = JSON.stringify({
        idea: previousResults.idea_analysis,
        market: previousResults.market_research,
      }, null, 2)
      return (role as { user: (idea: string, baseline: string) => string }).user(ideaTranscript, baselineData)
    }
    case 'critic': {
      const analysisData = JSON.stringify({
        idea: previousResults.idea_analysis,
        market: previousResults.market_research,
        strategy: previousResults.strategy,
        efficiency: previousResults.efficiency_model,
      }, null, 2)
      return (role as { user: (idea: string, analysis: string) => string }).user(ideaTranscript, analysisData)
    }
    default:
      throw new Error(`Неизвестная роль для шага: ${stepId}`)
  }
}

/**
 * Получает транскрипт идеи из контекста.
 * Ищет в предыдущих результатах или в данных идеи.
 */
function getIdeaTranscript(ctx: StepContext): string {
  // Ищем транскрипт в предыдущих результатах
  const ideaAnalysis = ctx.state.idea_analysis as { sourceTranscript?: string } | undefined
  if (ideaAnalysis?.sourceTranscript) {
    return ideaAnalysis.sourceTranscript
  }

  // Если это первый шаг (оркестратор), транскрипт должен быть передан извне
  // Пока используем заглушку — в реальности будет из БД
  return (ctx.state as { transcript?: string }).transcript ?? ''
}

/**
 * Создаёт LLM-исполнителя для указанной роли.
 * Записывает каждый вызов в run_calls (протокол прогона TZ §9).
 */
export function createLlmExecutor(roleId: string) {
  return async (ctx: StepContext): Promise<StepResult> => {
    const role = getRoleConfig(roleId)
    if (!role || !('system' in role)) {
      throw new Error(`Не найден LLM-конфиг для роли: ${roleId}`)
    }

    const llmRole = role as {
      system: string
      schema: unknown
      temperature?: number
      maxTokens?: number
      timeoutMs?: number
      retries?: number
    }

    const ideaTranscript = getIdeaTranscript(ctx)
    const userPrompt = buildUserPrompt(roleId, ideaTranscript, ctx.state)

    // Запись вызова через протокол прогона
    const runId = (ctx.state as { runId?: string }).runId
    const request = { system: llmRole.system, user: userPrompt, temperature: llmRole.temperature, maxTokens: llmRole.maxTokens }

    const callFn = async () => {
      return callLlm(
        llmRole.schema as Parameters<typeof callLlm>[0],
        {
          system: llmRole.system,
          user: userPrompt,
          temperature: llmRole.temperature,
          maxTokens: llmRole.maxTokens,
          timeoutMs: llmRole.timeoutMs,
        },
      )
    }

    let result: Awaited<ReturnType<typeof callFn>>

    if (ctx.db && runId) {
      result = await withRunCall(runId, 'llm', 'z-ai/glm-5.3-flash', request, callFn)
    }
    else {
      result = await callFn()
    }

    return {
      output: {
        data: result.data,
        metadata: {
          model: 'z-ai/glm-5.3-flash',
          role: roleId,
          step: ctx.step.id,
          usage: result.usage,
          cost: result.cost,
        },
      },
    }
  }
}
