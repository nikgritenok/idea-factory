import type { ExecutorKind } from '../../config/pipeline'
import type { Sql } from '../db/types'
import type { StepExecutor } from './types'

import { createLlmExecutor } from './llm-executor'

/**
 * Реестр исполнителей шагов пайплайна. Ключ = executor из config/pipeline.ts.
 * Этап 5: LLM-роли подключены (executor: 'llm').
 *
 * fixture — ЗАГЛУШКА: имитирует работу шага, явно помечена (FIXTURE: в логах).
 * Используется для детерминированных шагов (report_build) и тестов.
 *
 * llm — РЕАЛЬНЫЙ LLM: вызывает z-ai/glm-5.3-flash с валидацией ответа.
 * Каждая роль имеет свой промпт и Zod-схему для валидации.
 */
const FIXTURE_DELAY_MS = 50

const registry = new Map<ExecutorKind, StepExecutor>()

registry.set('fixture', async (ctx) => {
  const { signal, step } = ctx
  const started = Date.now()
  await delay(FIXTURE_DELAY_MS, signal)
  return {
    output: {
      durationMs: Date.now() - started,
      fixture: true,
      note: 'FIXTURE: заглушка шага пайплайна (детерминированная сборка или тест)',
      role: step.role,
      step: step.id,
    },
  }
})

/**
 * LLM-исполнитель: вызывает реальный LLM для роли из pipeline.ts.
 * Ключ 'llm' соответствует executor: 'llm' в config/pipeline.ts.
 * Конкретная роль определяется по step.role из контекста.
 */
registry.set('llm', async (ctx) => {
  const roleId = ctx.step.role
  const executor = createLlmExecutor(roleId)
  return executor(ctx)
})

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
      },
      { once: true },
    )
  })
}

export function getExecutor(kind: ExecutorKind): StepExecutor {
  const exec = registry.get(kind)
  if (!exec) {
    throw new Error(`Исполнитель шага не зарегистрирован: ${kind}`)
  }
  return exec
}

/** Есть ли в пайплайне не-fixture исполнители (для маркировки прогона) */
export function hasOnlyFixtureExecutors(steps: readonly { executor: ExecutorKind }[]): boolean {
  return steps.every(s => s.executor === 'fixture')
}

/** Регистрация исполнителя — точка расширения для новых типов исполнителей */
export function registerExecutor(kind: ExecutorKind, exec: StepExecutor): void {
  registry.set(kind, exec)
}

// Утилита для тестов: посчитать таблицу идей без лишних запросов
export type TestSql = Sql
