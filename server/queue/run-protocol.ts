import { db } from '../utils/db'

/**
 * Протокол прогона (TZ §9).
 * Записывает каждый вызов компонента в run_calls,
 * а общий прогон в runs.
 */

export interface RunCallRecord {
  component: string
  componentVersion?: string
  request: unknown
  response: unknown
  durationMs: number
  ok: boolean
  error?: string
}

export interface RunRecord {
  ideaId: string
  datasetId?: string
  variant: string
  componentVersions: Record<string, string>
  configVersion: string
  isFixture: boolean
}

/**
 * Создаёт запись прогона в таблице runs.
 * Возвращает runId для последующих записей вызовов.
 */
export async function createRun(
  record: RunRecord,
): Promise<string> {
  const row = await db.orm.public.Runs
    .select('id')
    .create({
      ideaId: record.ideaId,
      datasetId: record.datasetId ?? null,
      variant: record.variant,
      componentVersions: record.componentVersions,
      configVersion: record.configVersion,
      isFixture: record.isFixture,
      status: 'running',
    })
  return row.id
}

/**
 * Записывает вызов компонента в таблицу run_calls.
 */
export async function recordRunCall(
  runId: string,
  call: RunCallRecord,
): Promise<string> {
  const row = await db.orm.public.RunCalls
    .select('id')
    .create({
      runId,
      component: call.component,
      componentVersion: call.componentVersion ?? null,
      request: call.request,
      response: call.response,
      durationMs: call.durationMs,
      ok: call.ok,
      error: call.error ?? null,
    })
  return row.id
}

/**
 * Завершает прогон (обновляет статус и время окончания).
 */
export async function finishRun(
  runId: string,
  status: 'completed' | 'failed' | 'partial',
  error?: string,
): Promise<void> {
  await db.orm.public.Runs
    .where((f) => f.id.eq(runId))
    .update({
      status,
      finishedAt: new Date(),
      error: error ?? null,
    })
}

/**
 * Оборачивает вызов компонента протоколом: записывает входы/выходы/длительность.
 */
export async function withRunCall<T>(
  runId: string,
  component: string,
  componentVersion: string | undefined,
  request: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now()
  let response: unknown
  let ok = true
  let error: string | undefined

  try {
    response = await fn()
  }
  catch (err) {
    ok = false
    error = err instanceof Error ? err.message : String(err)
    response = { error }
  }
  finally {
    await recordRunCall(runId, {
      component,
      componentVersion,
      request,
      response,
      durationMs: Date.now() - started,
      ok,
      error,
    })
  }

  if (!ok) {
    throw new Error(error)
  }

  return response as T
}
