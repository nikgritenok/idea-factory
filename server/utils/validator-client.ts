/**
 * Клиент микросервиса-валидатора (services/validator/).
 * Вызывает POST /validate с протоколом прогона.
 */

import type { RunCallRecord } from '../queue/run-protocol'

import { db } from '../utils/db'

const VALIDATOR_URL = process.env.VALIDATOR_URL ?? 'http://localhost:3001'

export interface ValidateInput {
  category: string
  priority: string
  responsibleDepartment: string
}

export interface ValidateResult {
  errors: string[]
  valid: boolean
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
  runId?: string,
): Promise<ValidateResult> {
  const started = Date.now()
  let response: undefined | ValidateResult
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
    response = { errors: [error], valid: false }
  }

  // Запись в run_calls, если передан runId
  if (runId) {
    const callRecord: RunCallRecord = {
      component: 'validator',
      componentVersion: '1.0.0',
      durationMs: Date.now() - started,
      error,
      ok,
      request: input,
      response,
    }

    await db.orm.public.RunCalls.create({
      component: callRecord.component,
      componentVersion: callRecord.componentVersion,
      durationMs: callRecord.durationMs,
      error: callRecord.error ?? null,
      ok: callRecord.ok,
      request: JSON.parse(JSON.stringify(callRecord.request)),
      response: JSON.parse(JSON.stringify(callRecord.response)),
      runId,
    })
  }

  if (!ok) {
    throw new ValidatorError(error ?? 'Неизвестная ошибка валидатора')
  }

  return response
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
