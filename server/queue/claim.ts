import type { Sql } from '../db/migrate'
import { QUEUE_CONFIG } from '../../config/pipeline'
import { effectivePriority } from './priority'
import type { JobCheckpoint, JobRow, QueuePriority } from './types'

export interface ClaimOptions {
  now?: Date
  antiStarvationMinutes?: number
  antiStarvationBump?: number
  /**
   * Режим восстановления: забрать задачу в статусе running (остаток после
   * сбоя/рестарта воркера) и продолжить её с чекпоинта. Вызывается воркером
   * один раз при старте; в обычном цикле running-задачи не перезабираются
   * (иначе воркер перехватывал бы задачу, которую сам же выполняет).
   */
  resumeRunning?: boolean
}

/**
 * Выбор следующей задачи воркером (TZ §8).
 * queued: эффективный приоритет = базовый + анти-голодание; при равенстве —
 * по времени постановки (enqueued_at asc). Переход queued→running —
 * условный UPDATE (атомарно, без блокировки всего набора кандидатов).
 */
export async function claimNextJob(sql: Sql, opts: ClaimOptions = {}): Promise<JobRow | undefined> {
  return sql.begin(async (tx) => {
    // 1. Восстановление (только при старте воркера)
    if (opts.resumeRunning) {
      const [interrupted] = await tx`
        select * from queue_jobs
        where status = 'running'
        order by started_at asc nulls last, enqueued_at asc
        limit 1
        for update skip locked`
      if (interrupted) {
        const [claimed] = await tx`
          update queue_jobs set attempts = attempts + 1 where id = ${(interrupted as JobRow).id}
          returning *`
        return claimed as JobRow
      }
      return undefined
    }

    // 2. Очередь: расчёт эффективного приоритета с анти-голоданием (TZ §8)
    const now = opts.now ?? new Date()
    const candidates = await tx`
      select * from queue_jobs
      where status = 'queued'
      order by enqueued_at asc
      limit 20`

    let best: JobRow | undefined
    let bestScore = -1
    let bestTime = 0
    for (const row of candidates) {
      const job = row as JobRow
      const score = effectivePriority(
        job.priority as QueuePriority,
        job.enqueued_at,
        now,
        { antiStarvationMinutes: opts.antiStarvationMinutes, antiStarvationBump: opts.antiStarvationBump },
      )
      const isBetter
        = score > bestScore
          || (score === bestScore && job.enqueued_at.getTime() < bestTime)
      if (isBetter) {
        best = job
        bestScore = score
        bestTime = job.enqueued_at.getTime()
      }
    }
    if (!best) {
      return undefined
    }

    // Условный переход queued→running: если задачу забрал параллельный воркер,
    // UPDATE не совпадёт — возвращаем undefined (не выдаём дубль)
    const [claimed] = await tx`
      update queue_jobs
      set status = 'running', started_at = now(), attempts = attempts + 1,
          effective_priority = ${bestScore}
      where id = ${best.id} and status = 'queued'
      returning *`
    return claimed as JobRow | undefined
  })
}

/** Пустой чекпоинт для новой задачи */
export function initialCheckpoint(jobId: string): JobCheckpoint {
  return { thread_id: jobId, graph_started: false, last_step: null, rewind_to_step: null }
}

export const DEFAULT_QUEUE_CONFIG = QUEUE_CONFIG
