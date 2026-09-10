import type { JobCheckpoint, JobRow, PrismaDb, QueuePriority } from './types'

import { initialCheckpoint } from './claim'

export class QueueControlError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'QueueControlError'
  }
}

async function getJob(db: PrismaDb, jobId: string): Promise<JobRow> {
  const job = await db.orm.public.QueueJobs
    .where((f) => f.id.eq(jobId))
    .first()
  if (!job) {
    throw new QueueControlError(`Задача не найдена: ${jobId}`, 404)
  }
  return job as unknown as JobRow
}

/** Пауза (TZ §8): задача на границе шагов прекращается, чекпоинт сохраняется */
export async function pauseJob(db: PrismaDb, jobId: string): Promise<JobRow> {
  const job = await getJob(db, jobId)
  if (job.status === 'paused') {
    return job
  }
  if (job.status !== 'queued' && job.status !== 'running') {
    throw new QueueControlError(`Задачу в статусе «${job.status}» нельзя поставить на паузу`, 409)
  }
  const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(jobId)
  const updated = await db.orm.public.QueueJobs
    .where((f) => f.id.eq(jobId))
    .update({
      status: 'paused',
      checkpoint: { ...cp, graph_started: job.checkpoint?.graph_started ?? false },
    })
  await db.orm.public.Ideas
    .where((f) => f.id.eq(job.ideaId))
    .update({
      executionStatus: 'paused',
      updatedAt: new Date(),
    })
  return updated as unknown as JobRow
}

/** Продолжение (TZ §8): задача возвращается в очередь, воркер возобновит с чекпоинта */
export async function resumeJob(db: PrismaDb, jobId: string): Promise<JobRow> {
  const job = await getJob(db, jobId)
  if (job.status === 'queued' || job.status === 'running') {
    return job
  }
  if (job.status !== 'paused') {
    throw new QueueControlError(`Задачу в статусе «${job.status}» нельзя продолжить`, 409)
  }
  const updated = await db.orm.public.QueueJobs
    .where((f) => f.id.eq(jobId))
    .update({ status: 'queued' })
  await db.orm.public.Ideas
    .where((f) => f.id.eq(job.ideaId))
    .update({
      executionStatus: 'paused',
      updatedAt: new Date(),
    })
  return updated as unknown as JobRow
}

/** Отмена (TZ §8): задача прекращается на границе шагов, повторный запуск — новая задача */
export async function cancelJob(db: PrismaDb, jobId: string): Promise<JobRow> {
  const job = await getJob(db, jobId)
  if (job.status === 'cancelled' || job.status === 'done' || job.status === 'failed') {
    return job
  }
  const updated = await db.orm.public.QueueJobs
    .where((f) => f.id.eq(jobId))
    .update({
      status: 'cancelled',
      finishedAt: new Date(),
    })
  await db.orm.public.Ideas
    .where((f) => f.id.eq(job.ideaId))
    .update({
      executionStatus: 'paused',
      updatedAt: new Date(),
    })
  return updated as unknown as JobRow
}

/**
 * Повтор шага (TZ §8): откат к checkpoint перед указанным шагом; шаг и все
 * последующие выполнятся заново. Без параметра — повтор с последнего выполненного.
 * steps — пайплайн задачи (для валидации шага); без него валидация по id пропускается.
 */
export async function retryStep(
  db: PrismaDb,
  jobId: string,
  stepId?: string,
  steps?: ReadonlyArray<{ id: string }>,
): Promise<JobRow> {
  const job = await getJob(db, jobId)
  if (job.status === 'queued' || job.status === 'running') {
    throw new QueueControlError('Нельзя повторить шаг выполняющейся задачи — сначала пауза или отмена', 409)
  }

  const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(jobId)
  const target = stepId ?? job.currentStep
  if (!target) {
    throw new QueueControlError('Шаг для повтора не указан и в задаче нет выполненных шагов', 400)
  }
  if (steps && !steps.some(s => s.id === target)) {
    throw new QueueControlError(`Неизвестный шаг пайплайна: ${target}`, 400)
  }

  const nextCp: JobCheckpoint = { ...cp, rewind_to_step: target }
  const updated = await db.orm.public.QueueJobs
    .where((f) => f.id.eq(jobId))
    .update({
      status: 'queued',
      error: null,
      finishedAt: null,
      checkpoint: nextCp,
    })
  await db.orm.public.Ideas
    .where((f) => f.id.eq(job.ideaId))
    .update({
      executionStatus: 'paused',
      updatedAt: new Date(),
    })
  return updated as unknown as JobRow
}

/** Смена приоритета (TZ §8): обновляет задачу и идею; пересчёт — при следующем claim */
export async function setJobPriority(db: PrismaDb, jobId: string, priority: QueuePriority): Promise<JobRow> {
  const job = await getJob(db, jobId)
  if (job.status === 'done' || job.status === 'cancelled' || job.status === 'failed') {
    throw new QueueControlError(`Задача в статусе «${job.status}» — приоритет менять нечего`, 409)
  }
  const updated = await db.orm.public.QueueJobs
    .where((f) => f.id.eq(jobId))
    .update({ priority })
  await db.orm.public.Ideas
    .where((f) => f.id.eq(job.ideaId))
    .update({
      priority,
      updatedAt: new Date(),
    })
  return updated as unknown as JobRow
}
