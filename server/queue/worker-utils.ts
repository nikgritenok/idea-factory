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

export async function withTimeout(p: Promise<{ output: unknown }>, timeoutMs: number): Promise<{ output: unknown }> {
  return await Promise.race([
    p,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Таймаут шага ${timeoutMs} мс`))
      }, timeoutMs)
    }),
  ])
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/** История чекпоинтов: находит snapshot, из которого шаг выполнится повторно */
export async function findCheckpointBefore(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph: { getStateHistory(config: unknown): AsyncIterable<{ next: readonly string[], config: any }> },
  threadId: string,
  stepId: string,
): Promise<Record<string, unknown> | undefined> {
  const config = { configurable: { thread_id: threadId } }
  for await (const snapshot of graph.getStateHistory(config)) {
    if (snapshot.next.includes(stepId)) {
      return snapshot.config as Record<string, unknown>
    }
  }
  return undefined
}
