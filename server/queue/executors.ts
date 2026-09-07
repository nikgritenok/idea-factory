import type { Sql } from '../db/types'
import type { ExecutorKind } from '../../config/pipeline'
import type { StepExecutor } from './types'

/**
 * Реестр исполнителей шагов пайплайна. Ключ = executor из config/pipeline.ts.
 * Этап 4: только fixture. Этап 5 добавит 'llm' (роль по конфигу) — код очереди не меняется.
 *
 * fixture — ЗАГЛУШКА: имитирует работу шага, явно помечена (AGENTS: не выдавать
 * имитацию за реальный прогон). Используется, пока LLM-исполнители не подключены.
 */
const FIXTURE_DELAY_MS = 50

const registry = new Map<ExecutorKind, StepExecutor>()

registry.set('fixture', async (ctx) => {
  const { step, signal } = ctx
  const started = Date.now()
  await delay(FIXTURE_DELAY_MS, signal)
  return {
    output: {
      fixture: true,
      step: step.id,
      role: step.role,
      durationMs: Date.now() - started,
      note: 'FIXTURE: заглушка шага пайплайна, реальный исполнитель подключается в этапе 5',
    },
  }
})

async function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
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

/** Регистрация исполнителя — точка расширения для этапа 5 (реальные LLM-роли) */
export function registerExecutor(kind: ExecutorKind, exec: StepExecutor): void {
  registry.set(kind, exec)
}

// Утилита для тестов: посчитать таблицу идей без лишних запросов
export type TestSql = Sql
