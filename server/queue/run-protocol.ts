import type { Sql } from '../db/types'

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
  sql: Sql,
  record: RunRecord,
): Promise<string> {
  const [row] = await sql`
    INSERT INTO runs (idea_id, dataset_id, variant, component_versions, config_version, is_fixture, status)
    VALUES (
      ${record.ideaId},
      ${record.datasetId ?? null},
      ${record.variant},
      ${sql.json(record.componentVersions)},
      ${record.configVersion},
      ${record.isFixture},
      'running'
    )
    RETURNING id
  `
  return (row as { id: string }).id
}

/**
 * Записывает вызов компонента в таблицу run_calls.
 */
export async function recordRunCall(
  sql: Sql,
  runId: string,
  call: RunCallRecord,
): Promise<string> {
  const [row] = await sql`
    INSERT INTO run_calls (run_id, component, component_version, request, response, duration_ms, ok, error)
    VALUES (
      ${runId},
      ${call.component},
      ${call.componentVersion ?? null},
      ${sql.json(call.request)},
      ${sql.json(call.response)},
      ${call.durationMs},
      ${call.ok},
      ${call.error ?? null}
    )
    RETURNING id
  `
  return (row as { id: string }).id
}

/**
 * Завершает прогон (обновляет статус и время окончания).
 */
export async function finishRun(
  sql: Sql,
  runId: string,
  status: 'completed' | 'failed' | 'partial',
  error?: string,
): Promise<void> {
  await sql`
    UPDATE runs
    SET status = ${status}, finished_at = now(), error = ${error ?? null}
    WHERE id = ${runId}
  `
}

/**
 * Оборачивает вызов компонента протоколом: записывает входы/выходы/длительность.
 */
export async function withRunCall<T>(
  sql: Sql,
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
    await recordRunCall(sql, runId, {
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
