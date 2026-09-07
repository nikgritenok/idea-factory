import type { PipelineStep } from '../../config/pipeline'

export async function runWithRetry(
  fn: () => Promise<{ output: unknown }>,
  step: PipelineStep,
  retryDelayMs: number,
): Promise<{ output: unknown }> {
  let lastError: unknown
  for (let attempt = 0; attempt <= step.retries; attempt++) {
    try {
      return await withTimeout(fn(), step.timeoutMs)
    }
    catch (error) {
      lastError = error
      if (attempt < step.retries) {
        await sleep(retryDelayMs)
      }
    }
  }
  throw lastError instanceof Error
    ? new Error(`Шаг «${step.id}» не выполнен после ${step.retries + 1} попыток: ${lastError.message}`, { cause: lastError })
    : lastError
}

export function withTimeout(p: Promise<{ output: unknown }>, timeoutMs: number): Promise<{ output: unknown }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Таймаут шага ${timeoutMs} мс`)),
      timeoutMs,
    )
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** История чекпоинтов: находит snapshot, из которого шаг выполнится повторно */
export async function findCheckpointBefore(
  graph: { getStateHistory(config: unknown): AsyncIterable<{ next: readonly string[], config: Record<string, unknown> }> },
  threadId: string,
  stepId: string,
): Promise<Record<string, unknown> | undefined> {
  const config = { configurable: { thread_id: threadId } }
  for await (const snapshot of graph.getStateHistory(config)) {
    if (snapshot.next.includes(stepId)) {
      return snapshot.config
    }
  }
  return undefined
}
