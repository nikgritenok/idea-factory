/**
 * Клиент микросервиса-валидатора (services/validator/).
 * Вызывает POST /validate с протоколом прогона.
 */

import type { Sql } from '../db/types'
import type { RunCallRecord } from '../queue/run-protocol'

const VALIDATOR_URL = process.env.VALIDATOR_URL ?? 'http://localhost:3001'

export interface ValidateInput {
  category: string
  priority: string
  responsibleDepartment: string
}

export interface ValidateResult {
  valid: boolean
  errors: string[]
}

export class ValidatorError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ValidatorError'
  }
}

/**
 * Вызывает валидатор правил.
 * Если runId передан — записывает вызов в run_calls через протокол.
 */
export async function validateRules(
  input: ValidateInput,
  sql?: Sql,
  runId?: string,
): Promise<ValidateResult> {
  const started = Date.now()
  let response: ValidateResult | undefined
  let ok = true
  let error: string | undefined

  try {
    const res = await fetch(`${VALIDATOR_URL}/validate`, {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new ValidatorError(`Валидатор вернул HTTP ${res.status}: ${text}`, res.status)
    }

    response = await res.json() as ValidateResult
  }
  catch (err) {
    ok = false
    error = err instanceof Error ? err.message : String(err)
    response = { valid: false, errors: [error] }
  }

  // Запись в run_calls, если передан sql и runId
  if (sql && runId) {
    const callRecord: RunCallRecord = {
      component: 'validator',
      componentVersion: '1.0.0',
      request: input,
      response,
      durationMs: Date.now() - started,
      ok,
      error,
    }

    await sql`
      INSERT INTO run_calls (run_id, component, component_version, request, response, duration_ms, ok, error)
      VALUES (
        ${runId},
        ${callRecord.component},
        ${callRecord.componentVersion},
        ${sql.json(callRecord.request)},
        ${sql.json(callRecord.response)},
        ${callRecord.durationMs},
        ${callRecord.ok},
        ${callRecord.error ?? null}
      )
    `
  }

  if (!ok) {
    throw new ValidatorError(error)
  }

  return response!
}

/**
 * Проверяет доступность валидатора.
 */
export async function checkValidatorHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${VALIDATOR_URL}/version`)
    return res.ok
  }
  catch {
    return false
  }
}
