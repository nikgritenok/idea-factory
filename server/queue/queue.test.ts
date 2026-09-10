import 'temporal-polyfill/full/global'
import 'dotenv/config'
import postgres from '@prisma/orm-postgres/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { Contract } from '../../src/prisma/contract.d'

import contractJson from '../../src/prisma/contract.json' with { type: 'json' }
import { claimNextJob } from './claim'
import { enqueueIdeaAnalysis } from './enqueue'

const DB
  = process.env.TEST_DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test'

const db = postgres<Contract>({ contractJson, url: DB })

async function applyMigrations(dbUrl: string): Promise<void> {
  const raw = readFileSync(resolve(import.meta.dirname, '../../db/migrations/20260907000000_initial.sql'), 'utf8')
  const parts = raw.split('-- migrate:down')
  const up = (parts[0] ?? '').replace('-- migrate:up', '')
  const idempotent = up
    .replaceAll('create table ', 'create table if not exists ')
    .replaceAll('create index ', 'create index if not exists ')
  const client = new pg.Pool({ connectionString: dbUrl })
  try {
    await client.query(idempotent)
  }
  finally {
    await client.end()
  }
}

beforeAll(async () => {
  await applyMigrations(DB)
})

// Изоляция тестов: leftover-задачи из предыдущих тестов ломают порядок claim
beforeEach(async () => {
  const jobs = await db.orm.public.QueueJobs.select('id').all()
  for (const job of jobs) {
    await db.orm.public.QueueJobs.where(f => f.id.eq(job.id)).delete()
  }
  const ideas = await db.orm.public.Ideas.select('id').all()
  for (const idea of ideas) {
    await db.orm.public.Ideas.where(f => f.id.eq(idea.id)).delete()
  }
})

afterAll(async () => {
  await db.close()
})

async function insertIdea(title: string, priority: 'high' | 'low' | 'medium' = 'medium'): Promise<string> {
  const idea = await db.orm.public.Ideas.create({ priority, title })
  return idea.id
}

describe('enqueueIdeaAnalysis (TZ §8: постановка в очередь)', () => {
  it('создаёт задачу и переводит идею draft → queued', async () => {
    const ideaId = await insertIdea('enqueue-базовый')
    const { created, job } = await enqueueIdeaAnalysis(db, ideaId)
    expect(created).toBe(true)
    expect(job.status).toBe('queued')
    expect(job.ideaId).toBe(ideaId)
    expect(job.idempotencyKey).toBe(`analysis:${ideaId}`)

    const idea = await db.orm.public.Ideas
      .select('funnelStage')
      .where(f => f.id.eq(ideaId))
      .first()
    expect(idea?.funnelStage).toBe('queued')
  })

  it('повторный клик не создаёт дубль: возвращается та же активная задача', async () => {
    const ideaId = await insertIdea('enqueue-идемпотент')
    const first = await enqueueIdeaAnalysis(db, ideaId)
    const second = await enqueueIdeaAnalysis(db, ideaId)
    expect(second.created).toBe(false)
    expect(second.job.id).toBe(first.job.id)

    const jobs = await db.orm.public.QueueJobs
      .select('id')
      .where(f => f.ideaId.eq(ideaId))
      .all()
    expect(jobs).toHaveLength(1)
  })

  it('после завершённой задачи можно запустить заново — создаётся новая задача', async () => {
    const ideaId = await insertIdea('enqueue-повторный-запуск')
    const first = await enqueueIdeaAnalysis(db, ideaId)
    await db.orm.public.QueueJobs
      .where(f => f.id.eq(first.job.id))
      .update({ finishedAt: new Date().toISOString(), status: 'done' })

    const second = await enqueueIdeaAnalysis(db, ideaId)
    expect(second.created).toBe(true)
    expect(second.job.id).not.toBe(first.job.id)

    const jobs = await db.orm.public.QueueJobs
      .select('id')
      .where(f => f.ideaId.eq(ideaId))
      .all()
    expect(jobs).toHaveLength(2)
  })

  it('архивная идея не ставится в очередь', async () => {
    const idea = await db.orm.public.Ideas.create({ funnelStage: 'archived', title: 'enqueue-архив' })
    await expect(enqueueIdeaAnalysis(db, idea.id)).rejects.toThrow(/архиве/)
  })
})

describe('claimNextJob: приоритеты и FIFO (TZ §8)', () => {
  it('выбирает high раньше medium раньше low', async () => {
    const low = await insertIdea('claim-low', 'low')
    const high = await insertIdea('claim-high', 'high')
    const medium = await insertIdea('claim-medium', 'medium')
    await enqueueIdeaAnalysis(db, low)
    await enqueueIdeaAnalysis(db, medium)
    await enqueueIdeaAnalysis(db, high)

    const first = await claimNextJob(db)
    const second = await claimNextJob(db)
    const third = await claimNextJob(db)
    expect(first?.ideaId).toBe(high)
    expect(second?.ideaId).toBe(medium)
    expect(third?.ideaId).toBe(low)
  })

  it('при равном приоритете — по времени постановки (FIFO)', async () => {
    const a = await insertIdea('claim-fifo-a', 'medium')
    await enqueueIdeaAnalysis(db, a)
    await new Promise(r => setTimeout(r, 10))
    const b = await insertIdea('claim-fifo-b', 'medium')
    await enqueueIdeaAnalysis(db, b)

    const first = await claimNextJob(db)
    const second = await claimNextJob(db)
    expect(first?.ideaId).toBe(a)
    expect(second?.ideaId).toBe(b)
  })

  it('claim переводит задачу в running, считает попытку и эффективный приоритет', async () => {
    const ideaId = await insertIdea('claim-running', 'high')
    const { job } = await enqueueIdeaAnalysis(db, ideaId)

    const claimed = await claimNextJob(db)
    expect(claimed?.id).toBe(job.id)
    expect(claimed?.status).toBe('running')
    expect(claimed?.attempts).toBe(1)
    expect(claimed?.effectivePriority).toBeGreaterThan(0)
    expect(claimed?.startedAt).not.toBeNull()
  })
})

describe('anti-starvation (TZ §8)', () => {
  it('low, ждущая дольше N минут, обгоняет свежую medium', async () => {
    const ideaId = await insertIdea('starve-low', 'low')
    const { job } = await enqueueIdeaAnalysis(db, ideaId)
    // Задача ждёт 20 минут — set enqueued_at to 20 minutes ago
    await db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({ enqueuedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString() })

    const freshMedium = await insertIdea('starve-medium', 'medium')
    await enqueueIdeaAnalysis(db, freshMedium)

    const claimed = await claimNextJob(db, { antiStarvationMinutes: 15, now: new Date() })
    expect(claimed?.ideaId).toBe(ideaId)
  })

  it('анти-голодание не срабатывает раньше N минут', async () => {
    const ideaId = await insertIdea('starve-early-low', 'low')
    const { job } = await enqueueIdeaAnalysis(db, ideaId)
    await db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({ enqueuedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() })

    const freshMedium = await insertIdea('starve-early-medium', 'medium')
    await enqueueIdeaAnalysis(db, freshMedium)

    const claimed = await claimNextJob(db, { antiStarvationMinutes: 15, now: new Date() })
    expect(claimed?.ideaId).toBe(freshMedium)
  })

  it('повышение ограничено одним шагом: low не обгоняет high', async () => {
    const ideaId = await insertIdea('starve-cap-low', 'low')
    const { job } = await enqueueIdeaAnalysis(db, ideaId)
    await db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({ enqueuedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() })

    const freshHigh = await insertIdea('starve-cap-high', 'high')
    await enqueueIdeaAnalysis(db, freshHigh)

    const claimed = await claimNextJob(db, { antiStarvationMinutes: 15, now: new Date() })
    expect(claimed?.ideaId).toBe(freshHigh)
  })
})

describe('resume-first и блокировки claim', () => {
  it('прерванная (running) задача возобновляется раньше новых queued (режим восстановления)', async () => {
    const runningIdea = await insertIdea('resume-first-running', 'low')
    const leftover = await db.orm.public.QueueJobs.create({
      ideaId: runningIdea,
      priority: 'low',
      startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      status: 'running',
    })

    const queuedIdea = await insertIdea('resume-first-queued', 'high')
    await enqueueIdeaAnalysis(db, queuedIdea)

    // Восстановление при старте воркера: running раньше queued
    const claimed = await claimNextJob(db, { resumeRunning: true })
    expect(claimed?.id).toBe(leftover.id)

    // Обычный claim в цикле running-задачи не перезабирает
    const normal = await claimNextJob(db)
    expect(normal?.ideaId).toBe(queuedIdea)
  })

  it('в обычном цикле claim не перезабирает выполняющуюся (running) задачу', async () => {
    const a = await insertIdea('no-resteal-a', 'high')
    await enqueueIdeaAnalysis(db, a)
    const first = await claimNextJob(db)
    expect(first?.status).toBe('running')

    const b = await insertIdea('no-resteal-b', 'low')
    await enqueueIdeaAnalysis(db, b)
    const second = await claimNextJob(db)
    expect(second?.ideaId).toBe(b) // не running-задача a
  })

  it('параллельные claim не выдают одну задачу дважды (условный UPDATE)', async () => {
    const a = await insertIdea('parallel-a', 'medium')
    const b = await insertIdea('parallel-b', 'medium')
    await enqueueIdeaAnalysis(db, a)
    await enqueueIdeaAnalysis(db, b)

    const [x, y] = await Promise.all([claimNextJob(db), claimNextJob(db)])
    const ids = [x?.id, y?.id].filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
