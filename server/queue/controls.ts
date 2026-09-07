import type { Sql } from '../db/migrate'
import { initialCheckpoint } from './claim'
import type { JobCheckpoint, JobRow, QueuePriority } from './types'

export class QueueControlError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
    this.name = 'QueueControlError'
  }
}

async function getJob(sql: Sql, jobId: string): Promise<JobRow> {
  const [job] = await sql`select * from queue_jobs where id = ${jobId}`
  if (!job) {
    throw new QueueControlError(`Задача не найдена: ${jobId}`, 404)
  }
  return job as JobRow
}

/** Пауза (TZ §8): задача на границе шагов прекращается, чекпоинт сохраняется */
export async function pauseJob(sql: Sql, jobId: string): Promise<JobRow> {
  const job = await getJob(sql, jobId)
  if (job.status === 'paused') {
    return job
  }
  if (job.status !== 'queued' && job.status !== 'running') {
    throw new QueueControlError(`Задачу в статусе «${job.status}» нельзя поставить на паузу`, 409)
  }
  const [updated] = await sql`
    update queue_jobs set status = 'paused' where id = ${jobId} returning *`
  const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(jobId)
  await sql`
    update queue_jobs set checkpoint = ${sql.json({ ...cp, graph_started: job.checkpoint?.graph_started ?? false })} where id = ${jobId}`
  await sql`
    update ideas set execution_status = 'paused', updated_at = now() where id = ${job.idea_id}`
  return updated as JobRow
}

/** Продолжение (TZ §8): задача возвращается в очередь, воркер возобновит с чекпоинта */
export async function resumeJob(sql: Sql, jobId: string): Promise<JobRow> {
  const job = await getJob(sql, jobId)
  if (job.status === 'queued' || job.status === 'running') {
    return job
  }
  if (job.status !== 'paused') {
    throw new QueueControlError(`Задачу в статусе «${job.status}» нельзя продолжить`, 409)
  }
  const [updated] = await sql`
    update queue_jobs set status = 'queued' where id = ${jobId} returning *`
  await sql`
    update ideas set execution_status = 'paused', updated_at = now() where id = ${job.idea_id}`
  return updated as JobRow
}

/** Отмена (TZ §8): задача прекращается на границе шагов, повторный запуск — новая задача */
export async function cancelJob(sql: Sql, jobId: string): Promise<JobRow> {
  const job = await getJob(sql, jobId)
  if (job.status === 'cancelled' || job.status === 'done' || job.status === 'failed') {
    return job
  }
  const [updated] = await sql`
    update queue_jobs set status = 'cancelled', finished_at = now() where id = ${jobId} returning *`
  await sql`
    update ideas set execution_status = 'paused', updated_at = now() where id = ${job.idea_id}`
  return updated as JobRow
}

/**
 * Повтор шага (TZ §8): откат к checkpoint перед указанным шагом; шаг и все
 * последующие выполнятся заново. Без параметра — повтор с последнего выполненного.
 * steps — пайплайн задачи (для валидации шага); без него валидация по id пропускается.
 */
export async function retryStep(
  sql: Sql,
  jobId: string,
  stepId?: string,
  steps?: ReadonlyArray<{ id: string }>,
): Promise<JobRow> {
  const job = await getJob(sql, jobId)
  if (job.status === 'queued' || job.status === 'running') {
    throw new QueueControlError('Нельзя повторить шаг выполняющейся задачи — сначала пауза или отмена', 409)
  }

  const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(jobId)
  const target = stepId ?? job.current_step
  if (!target) {
    throw new QueueControlError('Шаг для повтора не указан и в задаче нет выполненных шагов', 400)
  }
  if (steps && !steps.some(s => s.id === target)) {
    throw new QueueControlError(`Неизвестный шаг пайплайна: ${target}`, 400)
  }

  const nextCp: JobCheckpoint = { ...cp, rewind_to_step: target }
  const [updated] = await sql`
    update queue_jobs
    set status = 'queued', error = null, finished_at = null, checkpoint = ${sql.json(nextCp)}
    where id = ${jobId}
    returning *`
  await sql`
    update ideas set execution_status = 'paused', updated_at = now() where id = ${job.idea_id}`
  return updated as JobRow
}

/** Смена приоритета (TZ §8): обновляет задачу и идею; пересчёт — при следующем claim */
export async function setJobPriority(sql: Sql, jobId: string, priority: QueuePriority): Promise<JobRow> {
  const job = await getJob(sql, jobId)
  if (job.status === 'done' || job.status === 'cancelled' || job.status === 'failed') {
    throw new QueueControlError(`Задача в статусе «${job.status}» — приоритет менять нечего`, 409)
  }
  const [updated] = await sql`
    update queue_jobs set priority = ${priority} where id = ${jobId} returning *`
  await sql`
    update ideas set priority = ${priority}, updated_at = now() where id = ${job.idea_id}`
  return updated as JobRow
}
