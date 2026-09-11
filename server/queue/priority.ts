import type { QueuePriority } from '../../config/pipeline'

import { QUEUE_CONFIG } from '../../config/pipeline'

/**
 * Анти-голодание (TZ §8): если задача в статусе queued ждёт дольше
 * antiStarvationMinutes — приоритет поднимается на один шаг
 * (low→medium, medium→high). Повышение не накапливается сверх одного шага.
 */
export function antiStarvationPriority(
  base: QueuePriority,
  waitedMinutes: number,
  now: {
    antiStarvationMinutes?: number
    antiStarvationBump?: number
  } = {},
): number {
  const minutes = now.antiStarvationMinutes ?? QUEUE_CONFIG.antiStarvationMinutes
  const bump = now.antiStarvationBump ?? QUEUE_CONFIG.antiStarvationBump
  const baseScore = QUEUE_CONFIG.priorityBase[base]
  return waitedMinutes >= minutes ? baseScore + bump : baseScore
}

export function effectivePriority(
  base: QueuePriority,
  enqueuedAt: Date | string,
  now: Date,
  cfg?: { antiStarvationMinutes?: number, antiStarvationBump?: number },
): number {
  const enqueuedMs
    = enqueuedAt instanceof Date
      ? enqueuedAt.getTime()
      : new Date(enqueuedAt).getTime()
  const nowMs = now.getTime()
  const waitedMinutes = Math.max(0, (nowMs - enqueuedMs) / 60_000)
  return antiStarvationPriority(base, waitedMinutes, cfg)
}

export const PRIORITY_SCORES = QUEUE_CONFIG.priorityBase
