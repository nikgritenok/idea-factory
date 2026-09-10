import type { PipelineStep } from '../../config/pipeline'
import type { JobRow, PrismaDb } from './types'

import { QUEUE_CONFIG } from '../../config/pipeline'
import { QueueControlError } from './controls'

/**
 * Постановка идеи в очередь анализа (TZ §8).
 * Идемпотентность: повторный клик «запустить» возвращает существующую активную задачу,
 * не создавая дубль. Ключ idempotency_key держит только активная задача;
 * при завершении задачи ключ освобождается для повторного запуска.
 */
export async function enqueueIdeaAnalysis(
  db: PrismaDb,
  ideaId: string,
): Promise<{ job: JobRow, created: boolean }> {
  const idea = await db.orm.public.Ideas
    .select('id', 'funnelStage', 'priority')
    .where((f) => f.id.eq(ideaId))
    .first()
  if (!idea) {
    throw new QueueControlError(`Идея не найдена: ${ideaId}`, 404)
  }
  if (idea.funnelStage === 'archived') {
    throw new QueueControlError('Идея в архиве — запуск невозможен', 409)
  }

  const key = `analysis:${ideaId}`

  // Активная задача уже есть → идемпотентный возврат (повторный клик не создаёт дубль)
  const existing = await db.orm.public.QueueJobs
    .where((f) => f.ideaId.eq(ideaId))
    .where((f) => f.status.in(['queued', 'running', 'paused']))
    .orderBy((f) => f.enqueuedAt.desc())
    .first()
  if (existing) {
    return { created: false, job: existing as unknown as JobRow }
  }

  const inserted = await insertJob(db, ideaId, String(idea.priority), key)
  return { created: true, job: inserted }
}

async function insertJob(db: PrismaDb, ideaId: string, priority: string, key: string): Promise<JobRow> {
  // on conflict do nothing: если ключ занят активной задачей, её вернёт идемпотентный
  // SELECT выше; если ключ у завершённой задачи — освобождаем его ниже
  try {
    const job = await db.orm.public.QueueJobs
      .select(
        'id', 'ideaId', 'priority', 'effectivePriority', 'status',
        'attempts', 'currentStep', 'checkpoint', 'idempotencyKey',
        'enqueuedAt', 'startedAt', 'finishedAt', 'error',
      )
      .create({
        ideaId,
        priority,
        effectivePriority: QUEUE_CONFIG.priorityBase[priority as keyof typeof QUEUE_CONFIG.priorityBase],
        idempotencyKey: key,
      })
    await db.orm.public.Ideas
      .where((f) => f.id.eq(ideaId))
      .update({
        funnelStage: 'queued',
        updatedAt: new Date(),
      })
    return job as unknown as JobRow
  }
  catch {
    // Conflict — key already exists
  }

  // Ключ занят: активная задача → идемпотентный возврат (гонка параллельных кликов),
  // завершённая → освобождаем ключ (версионируем) и вставляем заново
  const old = await db.orm.public.QueueJobs
    .where((f) => f.idempotencyKey.eq(key))
    .first()
  if (old) {
    const status = (old as unknown as JobRow).status
    if (status === 'queued' || status === 'running' || status === 'paused') {
      return old as unknown as JobRow
    }
    await db.orm.public.QueueJobs
      .where((f) => f.id.eq(old.id))
      .update({ idempotencyKey: `${key}:${old.id}` })
  }
  const job2 = await db.orm.public.QueueJobs
    .select(
      'id', 'ideaId', 'priority', 'effectivePriority', 'status',
      'attempts', 'currentStep', 'checkpoint', 'idempotencyKey',
      'enqueuedAt', 'startedAt', 'finishedAt', 'error',
    )
    .create({
      ideaId,
      priority,
      effectivePriority: QUEUE_CONFIG.priorityBase[priority as keyof typeof QUEUE_CONFIG.priorityBase],
      idempotencyKey: key,
    })
  if (!job2) {
    throw new Error(`Не удалось поставить задачу в очередь: ${ideaId}`)
  }
  await db.orm.public.Ideas
    .where((f) => f.id.eq(ideaId))
    .update({
      funnelStage: 'queued',
      updatedAt: new Date(),
    })
  return job2 as unknown as JobRow
}

/** Список шагов пайплайна — для API «повтор шага» и проверок */
export function stepIds(steps: readonly PipelineStep[]): string[] {
  return steps.map(s => s.id)
}
