import type { JobCheckpoint, JobRow, PrismaDb } from './types'

import { QUEUE_CONFIG } from '../../config/pipeline'
import { effectivePriority } from './priority'

function toEpochMs(value: Date | string | Temporal.Instant): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') return Temporal.Instant.from(value).epochMilliseconds
  return Number(value.epochMilliseconds)
}

export interface ClaimOptions {
  antiStarvationBump?: number
  antiStarvationMinutes?: number
  now?: Date
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
export async function claimNextJob(db: PrismaDb, opts: ClaimOptions = {}): Promise<JobRow | undefined> {
  return await db.transaction(async (tx) => {
    // 1. Восстановление (только при старте воркера)
    if (opts.resumeRunning) {
      const interrupted = await tx.orm.public.QueueJobs
        .where(f => f.status.eq('running'))
        .orderBy(f => f.startedAt.asc())
        .first()
      if (interrupted) {
        const claimed = await tx.orm.public.QueueJobs
          .where(f => f.id.eq(interrupted.id))
          .update({ attempts: interrupted.attempts + 1 })
        return claimed as unknown as JobRow
      }
      return
    }

    // 2. Очередь: расчёт эффективного приоритета с анти-голоданием (TZ §8)
    const now = opts.now ?? new Date()
    const candidates = await tx.orm.public.QueueJobs
      .where(f => f.status.eq('queued'))
      .orderBy(f => f.enqueuedAt.asc())
      .limit(20)
      .all()

    let best: JobRow | undefined
    let bestScore = -1
    let bestTime = 0
    for (const row of candidates) {
      const job = row as unknown as JobRow
      const score = effectivePriority(
        job.priority,
        job.enqueuedAt,
        now,
        { antiStarvationBump: opts.antiStarvationBump, antiStarvationMinutes: opts.antiStarvationMinutes },
      )
      const isBetter
        = score > bestScore
          || (score === bestScore && toEpochMs(job.enqueuedAt) < bestTime)
      if (isBetter) {
        best = job
        bestScore = score
        bestTime = toEpochMs(job.enqueuedAt)
      }
    }
    if (!best) {
      return
    }

    // Условный переход queued→running: если задачу забрал параллельный воркер,
    // UPDATE не совпадёт — возвращаем undefined (не выдаём дубль)
    const claimed = await tx.orm.public.QueueJobs
      .where(f => f.id.eq(best.id))
      .where(f => f.status.eq('queued'))
      .update({
        attempts: best.attempts + 1,
        effectivePriority: bestScore,
        startedAt: new Date().toISOString(),
        status: 'running',
      })
    return claimed as unknown as JobRow | undefined
  })
}

/** Пустой чекпоинт для новой задачи */
export function initialCheckpoint(jobId: string): JobCheckpoint {
  return { graph_started: false, last_step: null, rewind_to_step: null, thread_id: jobId }
}

export const DEFAULT_QUEUE_CONFIG = QUEUE_CONFIG
