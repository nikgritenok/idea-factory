import type { PipelineStep } from '../../config/pipeline'
import type { Sql } from '../db/types'
import type { JobRow } from './types'

import { QUEUE_CONFIG } from '../../config/pipeline'
import { QueueControlError } from './controls'

/**
 * Постановка идеи в очередь анализа (TZ §8).
 * Идемпотентность: повторный клик «запустить» возвращает существующую активную задачу,
 * не создавая дубль. Ключ idempotency_key держит только активная задача;
 * при завершении задачи ключ освобождается для повторного запуска.
 */
export async function enqueueIdeaAnalysis(
  sql: Sql,
  ideaId: string,
): Promise<{ job: JobRow, created: boolean }> {
  const [idea] = await sql`
    select id, funnel_stage, priority from ideas where id = ${ideaId}`
  if (!idea) {
    throw new QueueControlError(`Идея не найдена: ${ideaId}`, 404)
  }
  if (idea.funnel_stage === 'archived') {
    throw new QueueControlError('Идея в архиве — запуск невозможен', 409)
  }

  const key = `analysis:${ideaId}`

  // Активная задача уже есть → идемпотентный возврат (повторный клик не создаёт дубль)
  const [existing] = await sql`
    select * from queue_jobs
    where idea_id = ${ideaId} and status in ('queued', 'running', 'paused')
    order by enqueued_at desc limit 1`
  if (existing) {
    return { created: false, job: existing as JobRow }
  }

  const inserted = await insertJob(sql, ideaId, String(idea.priority), key)
  return { created: true, job: inserted }
}

async function insertJob(sql: Sql, ideaId: string, priority: string, key: string): Promise<JobRow> {
  // on conflict do nothing: если ключ занят активной задачей, её вернёт идемпотентный
  // SELECT выше; если ключ у завершённой задачи — освобождаем его ниже
  const rows = await sql`
    insert into queue_jobs (idea_id, priority, effective_priority, idempotency_key)
    values (${ideaId}, ${priority}, ${QUEUE_CONFIG.priorityBase[priority as keyof typeof QUEUE_CONFIG.priorityBase]}, ${key})
    on conflict (idempotency_key) do nothing
    returning *`
  const job = rows[0] as JobRow | undefined
  if (job) {
    await sql`
      update ideas set funnel_stage = 'queued', updated_at = now() where id = ${ideaId}`
    return job
  }

  // Ключ занят: активная задача → идемпотентный возврат (гонка параллельных кликов),
  // завершённая → освобождаем ключ (версионируем) и вставляем заново
  return await sql.begin(async (tx) => {
    const [old] = await tx`
      select * from queue_jobs where idempotency_key = ${key} limit 1`
    if (old) {
      const status = (old as JobRow).status
      if (status === 'queued' || status === 'running' || status === 'paused') {
        return old as JobRow
      }
      await tx`
        update queue_jobs set idempotency_key = ${key + ':' + (old as JobRow).id} where id = ${(old as JobRow).id}`
    }
    const retry = await tx`
      insert into queue_jobs (idea_id, priority, effective_priority, idempotency_key)
      values (${ideaId}, ${priority}, ${QUEUE_CONFIG.priorityBase[priority as keyof typeof QUEUE_CONFIG.priorityBase]}, ${key})
      returning *`
    const job2 = retry[0] as JobRow | undefined
    if (!job2) {
      throw new Error(`Не удалось поставить задачу в очередь: ${ideaId}`)
    }
    await tx`
      update ideas set funnel_stage = 'queued', updated_at = now() where id = ${ideaId}`
    return job2
  })
}

/** Список шагов пайплайна — для API «повтор шага» и проверок */
export function stepIds(steps: readonly PipelineStep[]): string[] {
  return steps.map(s => s.id)
}
