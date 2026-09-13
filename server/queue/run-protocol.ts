import { db } from '../utils/db'

/**
 * Протокол прогона (TZ §9).
 * Записывает каждый вызов компонента в run_calls,
 * а общий прогон в runs.
 */

export interface RunCallRecord {
  component: string
  componentVersion?: string
  durationMs: number
  error?: string
  ok: boolean
  request: unknown
  response: unknown
}

export interface RunRecord {
  componentVersions: Record<string, string>
  configVersion: string
  datasetId?: string
  ideaId: string
  isFixture: boolean
  variant: string
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
      componentVersions: record.componentVersions,
      configVersion: record.configVersion,
      datasetId: record.datasetId ?? null,
      ideaId: record.ideaId,
      isFixture: record.isFixture,
      status: 'running',
      variant: record.variant,
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
      component: call.component,
      componentVersion: call.componentVersion ?? null,
      durationMs: call.durationMs,
      error: call.error ?? null,
      ok: call.ok,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- колонка jsonb в RunCalls: форма запроса известна только исполнителю
      request: call.request as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- колонка jsonb в RunCalls: ответ модели/сервиса произвольной формы
      response: call.response as any,
      runId,
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
    .where(f => f.id.eq(runId))
    .update({
      error: error ?? null,
      finishedAt: new Date().toISOString(),
      status,
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
      durationMs: Date.now() - started,
      error,
      ok,
      request,
      response,
    })
  }

  if (!ok) {
    throw new Error(error)
  }

  return response as T
}
