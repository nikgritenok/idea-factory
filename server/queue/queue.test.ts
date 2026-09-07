import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import postgres from 'postgres'
import { migrateUp } from '../db/migrate'
import { enqueueIdeaAnalysis } from './enqueue'
import { claimNextJob } from './claim'

const DB
  = process.env.TEST_DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test'

const sql = postgres(DB, { max: 5 })

beforeAll(async () => {
  await sql.unsafe('drop schema public cascade; create schema public;')
  await migrateUp(sql as unknown as never)
})

// Изоляция тестов: leftover-задачи из предыдущих тестов ломают порядок claim
beforeEach(async () => {
  await sql`delete from ideas`
})

afterAll(async () => {
  await sql.end()
})

async function insertIdea(title: string, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<string> {
  const [row] = await sql`
    insert into ideas (title, priority) values (${title}, ${priority}) returning id`
  return (row as { id: string }).id
}

describe('enqueueIdeaAnalysis (TZ §8: постановка в очередь)', () => {
  it('создаёт задачу и переводит идею draft → queued', async () => {
    const ideaId = await insertIdea('enqueue-базовый')
    const { job, created } = await enqueueIdeaAnalysis(sql, ideaId)
    expect(created).toBe(true)
    expect(job.status).toBe('queued')
    expect(job.idea_id).toBe(ideaId)
    expect(job.idempotency_key).toBe(`analysis:${ideaId}`)

    const [idea] = await sql`select funnel_stage from ideas where id = ${ideaId}`
    expect((idea as { funnel_stage: string }).funnel_stage).toBe('queued')
  })

  it('повторный клик не создаёт дубль: возвращается та же активная задача', async () => {
    const ideaId = await insertIdea('enqueue-идемпотент')
    const first = await enqueueIdeaAnalysis(sql, ideaId)
    const second = await enqueueIdeaAnalysis(sql, ideaId)
    expect(second.created).toBe(false)
    expect(second.job.id).toBe(first.job.id)

    const jobs = await sql`select count(*) as n from queue_jobs where idea_id = ${ideaId}`
    expect(Number((jobs[0] as { n: number }).n)).toBe(1)
  })

  it('после завершённой задачи можно запустить заново — создаётся новая задача', async () => {
    const ideaId = await insertIdea('enqueue-повторный-запуск')
    const first = await enqueueIdeaAnalysis(sql, ideaId)
    await sql`update queue_jobs set status = 'done', finished_at = now() where id = ${first.job.id}`

    const second = await enqueueIdeaAnalysis(sql, ideaId)
    expect(second.created).toBe(true)
    expect(second.job.id).not.toBe(first.job.id)

    const jobs = await sql`select count(*) as n from queue_jobs where idea_id = ${ideaId}`
    expect(Number((jobs[0] as { n: number }).n)).toBe(2)
  })

  it('архивная идея не ставится в очередь', async () => {
    const [row] = await sql`
      insert into ideas (title, funnel_stage) values ('enqueue-архив', 'archived') returning id`
    const ideaId = (row as { id: string }).id
    await expect(enqueueIdeaAnalysis(sql, ideaId)).rejects.toThrow(/архиве/)
  })
})

describe('claimNextJob: приоритеты и FIFO (TZ §8)', () => {
  it('выбирает high раньше medium раньше low', async () => {
    const low = await insertIdea('claim-low', 'low')
    const high = await insertIdea('claim-high', 'high')
    const medium = await insertIdea('claim-medium', 'medium')
    await enqueueIdeaAnalysis(sql, low)
    await enqueueIdeaAnalysis(sql, medium)
    await enqueueIdeaAnalysis(sql, high)

    const first = await claimNextJob(sql)
    const second = await claimNextJob(sql)
    const third = await claimNextJob(sql)
    expect(first?.idea_id).toBe(high)
    expect(second?.idea_id).toBe(medium)
    expect(third?.idea_id).toBe(low)
  })

  it('при равном приоритете — по времени постановки (FIFO)', async () => {
    const a = await insertIdea('claim-fifo-a', 'medium')
    await enqueueIdeaAnalysis(sql, a)
    await new Promise(r => setTimeout(r, 10))
    const b = await insertIdea('claim-fifo-b', 'medium')
    await enqueueIdeaAnalysis(sql, b)

    const first = await claimNextJob(sql)
    const second = await claimNextJob(sql)
    expect(first?.idea_id).toBe(a)
    expect(second?.idea_id).toBe(b)
  })

  it('claim переводит задачу в running, считает попытку и эффективный приоритет', async () => {
    const ideaId = await insertIdea('claim-running', 'high')
    const { job } = await enqueueIdeaAnalysis(sql, ideaId)

    const claimed = await claimNextJob(sql)
    expect(claimed?.id).toBe(job.id)
    expect(claimed?.status).toBe('running')
    expect(claimed?.attempts).toBe(1)
    expect(claimed?.effective_priority).toBeGreaterThan(0)
    expect(claimed?.started_at).not.toBeNull()
  })
})

describe('anti-starvation (TZ §8)', () => {
  it('low, ждущая дольше N минут, обгоняет свежую medium', async () => {
    const ideaId = await insertIdea('starve-low', 'low')
    const { job } = await enqueueIdeaAnalysis(sql, ideaId)
    // Задача ждёт 20 минут
    await sql`update queue_jobs set enqueued_at = now() - interval '20 minutes' where id = ${job.id}`

    const freshMedium = await insertIdea('starve-medium', 'medium')
    await enqueueIdeaAnalysis(sql, freshMedium)

    const claimed = await claimNextJob(sql, { now: new Date(), antiStarvationMinutes: 15 })
    expect(claimed?.idea_id).toBe(ideaId)
  })

  it('анти-голодание не срабатывает раньше N минут', async () => {
    const ideaId = await insertIdea('starve-early-low', 'low')
    const { job } = await enqueueIdeaAnalysis(sql, ideaId)
    await sql`update queue_jobs set enqueued_at = now() - interval '5 minutes' where id = ${job.id}`

    const freshMedium = await insertIdea('starve-early-medium', 'medium')
    await enqueueIdeaAnalysis(sql, freshMedium)

    const claimed = await claimNextJob(sql, { now: new Date(), antiStarvationMinutes: 15 })
    expect(claimed?.idea_id).toBe(freshMedium)
  })

  it('повышение ограничено одним шагом: low не обгоняет high', async () => {
    const ideaId = await insertIdea('starve-cap-low', 'low')
    const { job } = await enqueueIdeaAnalysis(sql, ideaId)
    await sql`update queue_jobs set enqueued_at = now() - interval '3 hours' where id = ${job.id}`

    const freshHigh = await insertIdea('starve-cap-high', 'high')
    await enqueueIdeaAnalysis(sql, freshHigh)

    const claimed = await claimNextJob(sql, { now: new Date(), antiStarvationMinutes: 15 })
    expect(claimed?.idea_id).toBe(freshHigh)
  })
})

describe('resume-first и блокировки claim', () => {
  it('прерванная (running) задача возобновляется раньше новых queued (режим восстановления)', async () => {
    const runningIdea = await insertIdea('resume-first-running', 'low')
    const [leftover] = await sql`
      insert into queue_jobs (idea_id, priority, status, started_at)
      values (${runningIdea}, 'low', 'running', now() - interval '1 hour') returning id`

    const queuedIdea = await insertIdea('resume-first-queued', 'high')
    await enqueueIdeaAnalysis(sql, queuedIdea)

    // Восстановление при старте воркера: running раньше queued
    const claimed = await claimNextJob(sql, { resumeRunning: true })
    expect(claimed?.id).toBe((leftover as { id: string }).id)

    // Обычный claim в цикле running-задачи не перезабирает
    const normal = await claimNextJob(sql)
    expect(normal?.idea_id).toBe(queuedIdea)
  })

  it('в обычном цикле claim не перезабирает выполняющуюся (running) задачу', async () => {
    const a = await insertIdea('no-resteal-a', 'high')
    await enqueueIdeaAnalysis(sql, a)
    const first = await claimNextJob(sql)
    expect(first?.status).toBe('running')

    const b = await insertIdea('no-resteal-b', 'low')
    await enqueueIdeaAnalysis(sql, b)
    const second = await claimNextJob(sql)
    expect(second?.idea_id).toBe(b) // не running-задача a
  })

  it('параллельные claim не выдают одну задачу дважды (условный UPDATE)', async () => {
    const a = await insertIdea('parallel-a', 'medium')
    const b = await insertIdea('parallel-b', 'medium')
    await enqueueIdeaAnalysis(sql, a)
    await enqueueIdeaAnalysis(sql, b)

    const [x, y] = await Promise.all([claimNextJob(sql), claimNextJob(sql)])
    const ids = [x?.id, y?.id].filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
