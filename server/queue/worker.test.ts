import 'temporal-polyfill/full/global'
import 'dotenv/config'
import postgres from '@prisma/orm-postgres/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Contract } from '../../src/prisma/contract.d'
import type { JobRow, StepExecutor } from './types'

import contractJson from '../../src/prisma/contract.json' with { type: 'json' }
import { type CheckpointerHandle, createCheckpointer, ensureCheckpointerTables } from './checkpointer'
import { claimNextJob } from './claim'
import { cancelJob, pauseJob, QueueControlError, resumeJob, retryStep, setJobPriority } from './controls'
import { enqueueIdeaAnalysis } from './enqueue'
import { AnalysisWorker } from './worker'

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

let mainCheckpointer: CheckpointerHandle

/** Тестовый пайплайн: 3 шага, s2 с retries, funnel после s3 */
const steps = [
  { executor: 't1', id: 's1', retries: 0, role: 'r1', timeoutMs: 3000, title: 's1' },
  { executor: 't2', id: 's2', retries: 1, role: 'r2', timeoutMs: 3000, title: 's2' },
  {
    executor: 't3',
    funnelStageAfter: 'decision' as const,
    id: 's3',
    retries: 0,
    role: 'r3',
    timeoutMs: 3000,
    title: 's3',
  },
]

interface Counters { s1: number, s2: number, s3: number }

function counters(): Counters {
  return { s1: 0, s2: 0, s3: 0 }
}

function countingExecutors(c: Counters, overrides: Record<string, StepExecutor> = {}): Record<string, StepExecutor> {
  // eslint-disable-next-line ai-guard/no-async-without-await -- return type requires async
  const count = (id: keyof Counters): StepExecutor => async () => {
    c[id]++
    return { output: { done: id } }
  }
  return {
    t1: count('s1'),
    t2: count('s2'),
    t3: count('s3'),
    ...overrides,
  }
}

/** Исполнитель, зависающий до release() — для паузы/отмены/«краха».
 * Уважает AbortSignal: при отмене узла отклоняется (корректное поведение шага). */
function barrierExec(
  hold: { release?: () => void, promise?: Promise<void>, onStarted?: () => void },
  tag: string,
): StepExecutor {
  return async (ctx) => {
    hold.onStarted?.()
    if (hold.promise) {
      const { signal } = ctx
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          reject(new Error('aborted'))
        }
        if (signal.aborted) {
          onAbort()
          return
        }
        signal.addEventListener('abort', onAbort, { once: true })
        hold.promise!.then(
          () => {
            signal.removeEventListener('abort', onAbort)
            resolve()
          },
          reject,
        )
      })
    }
    return { output: { barrier: tag } }
  }
}

function openBarrier(): { promise: Promise<void>, release: () => void } {
  let releaseFn!: () => void
  const promise = new Promise<void>((resolve) => {
    releaseFn = resolve
  })
  return { promise, release: releaseFn }
}

async function insertIdea(title: string, priority?: string): Promise<string> {
  const idea = priority
    ? await db.orm.public.Ideas.create({ priority, title })
    : await db.orm.public.Ideas.create({ title })
  return idea.id
}

async function getJob(jobId: string): Promise<JobRow> {
  const row = await db.orm.public.QueueJobs
    .where(f => f.id.eq(jobId))
    .first()
  return row as unknown as JobRow
}

async function waitFor(check: () => boolean, timeoutMs = 5000, message = 'условие не выполнено'): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) {
      return
    }
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error(`${message} за ${timeoutMs} мс`)
}

/** Стабилизация чекпоинтов: LangGraph коммитит асинхронно; ждём, пока счётчик
 * строк чекпоинтов потока перестанет расти (симуляция смерти процесса) */
async function waitForCheckpointStability(threadId: string): Promise<void> {
  let last = -1
  let stable = 0
  const deadline = Date.now() + 3000
  const client = new pg.Client({ connectionString: DB })
  await client.connect()
  try {
    while (Date.now() < deadline && stable < 2) {
      const result = await client.query('SELECT count(*)::int AS n FROM checkpoints WHERE thread_id = $1', [threadId])
      const n = result.rows[0].n
      stable = n === last ? stable + 1 : 0
      last = n
      await new Promise(r => setTimeout(r, 40))
    }
  }
  finally {
    await client.end()
  }
}

async function waitForStep(jobId: string, stepId: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const job = await getJob(jobId)
    if (job.currentStep === stepId) {
      return
    }
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error(`Шаг ${stepId} не достигнут за ${timeoutMs} мс`)
}

function makeWorker(c: Counters, checkpointer: CheckpointerHandle, overrides?: Record<string, StepExecutor>): AnalysisWorker {
  return new AnalysisWorker(db, {
    checkpointer,
    executors: countingExecutors(c, overrides),
    retryDelayMs: 20,
    steps,
  })
}

beforeAll(async () => {
  await applyMigrations(DB)
  mainCheckpointer = createCheckpointer(DB)
  await ensureCheckpointerTables(mainCheckpointer)
})

afterAll(async () => {
  await mainCheckpointer.end()
  await db.close()
})

describe('AnalysisWorker: базовый прогон', () => {
  it('выполняет все шаги по порядку, задача done, идея в decision (funnel TZ §3)', { timeout: 10_000 }, async () => {
    const c = counters()
    const worker = makeWorker(c, mainCheckpointer)
    const ideaId = await insertIdea('worker-базовый')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)
    expect(job).toBeDefined()

    const outcome = await worker.executeJob(job as JobRow)
    expect(outcome).toBe('done')

    const after = await getJob(job!.id)
    expect(after.status).toBe('done')
    expect(after.currentStep).toBe('s3')
    expect(after.checkpoint?.graph_started).toBe(true)
    expect(after.finishedAt).not.toBeNull()

    const idea = await db.orm.public.Ideas
      .select('funnelStage', 'executionStatus')
      .where(f => f.id.eq(ideaId))
      .first()
    expect(idea?.funnelStage).toBe('decision')
    expect(idea?.executionStatus).toBe('paused')

    expect(c).toEqual({ s1: 1, s2: 1, s3: 1 })
  })
})

describe('рестарт воркера продолжает с последнего корректного шага (TZ §8, ключевой тест)', () => {
  it('после «краха» на s3 новый воркер не повторяет s1/s2', { timeout: 20_000 }, async () => {
    const cA = counters()
    const cB = counters()

    // «Упавший» воркер: собственный пул чекпоинтера (как отдельный процесс)
    const crashCheckpointer = createCheckpointer(DB)
    await ensureCheckpointerTables(crashCheckpointer)

    // Воркер A выполняет s1, s2 и зависает на s3 — процесс «умирает» (промис брошен)
    let s3Started = false
    const crashBarrier: Parameters<typeof barrierExec>[0] = {
      onStarted: () => {
        s3Started = true
      },
      promise: new Promise<void>(() => {}),
    }
    const workerA = new AnalysisWorker(db, {
      checkpointer: crashCheckpointer,
      executors: countingExecutors(cA, { t3: barrierExec(crashBarrier, 'A-s3') }),
      retryDelayMs: 20,
      steps,
    })

    const ideaId = await insertIdea('worker-рестарт')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)

    void workerA.executeJob(job as JobRow)
    await waitForStep(job!.id, 's2')
    await waitFor(() => s3Started, 5000, 's3 не стартовал')
    await waitForCheckpointStability(job!.id)

    const leftover = await getJob(job!.id)
    expect(leftover.status).toBe('running')

    // Новый воркер с новым чекпоинтером продолжает с последнего корректного шага
    // (claim в режиме восстановления, как при старте воркера после рестарта)
    const workerB = makeWorker(cB, mainCheckpointer)
    const resumed = await claimNextJob(db, { resumeRunning: true })
    expect(resumed?.id).toBe(job!.id)

    const outcome = await workerB.executeJob(resumed as JobRow)
    expect(outcome).toBe('done')

    // A: s1, s2 выполнены, s3 завис (не завершён)
    expect(cA).toEqual({ s1: 1, s2: 1, s3: 0 })
    // Ключевые свойства TZ §8: воркер B продолжил с чекпоинта —
    // не с нуля (s1 не повторяется) и не весь пайплайн заново
    expect(cB.s1).toBe(0)
    expect(cB.s3).toBe(1)
    expect(cB.s1 + cB.s2).toBeLessThanOrEqual(1)

    const done = await getJob(job!.id)
    expect(done.status).toBe('done')

    await crashCheckpointer.end()
  })
})

describe('пауза и продолжение (TZ §8)', () => {
  it('пауза на границе шага, продолжение с чекпоинта без повтора выполненных шагов', { timeout: 20_000 }, async () => {
    const c = counters()
    const barrier = openBarrier()
    const worker = makeWorker(c, mainCheckpointer, { t3: barrierExec(barrier, 'pause-s3') })

    const ideaId = await insertIdea('worker-пауза')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)

    const execution = worker.executeJob(job as JobRow)
    await waitForStep(job!.id, 's2')

    await pauseJob(db, job!.id)

    barrier.release()
    const outcome = await execution
    expect(outcome).toBe('paused')

    const paused = await getJob(job!.id)
    expect(paused.status).toBe('paused')
    expect(paused.checkpoint?.graph_started).toBe(true)

    // Продолжение: воркер возобновляет с s3, s1/s2 не повторяются
    await resumeJob(db, job!.id)
    const resumedJob = await claimNextJob(db)
    expect(resumedJob?.id).toBe(job!.id)
    const outcome2 = await worker.executeJob(resumedJob as JobRow)
    expect(outcome2).toBe('done')
    // s1/s2 не повторились; s3 выполнен один раз — после продолжения
    expect(c.s1).toBe(1)
    expect(c.s2).toBe(1)
  })
})

describe('отмена (TZ §8)', () => {
  it('отмена останавливает задачу на границе шага, дальнейшие шаги не выполняются', { timeout: 20_000 }, async () => {
    const c = counters()
    const barrier = openBarrier()
    const worker = makeWorker(c, mainCheckpointer, { t3: barrierExec(barrier, 'cancel-s3') })

    const ideaId = await insertIdea('worker-отмена')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)

    const execution = worker.executeJob(job as JobRow)
    await waitForStep(job!.id, 's2')
    await cancelJob(db, job!.id)

    barrier.release()
    const outcome = await execution
    expect(outcome).toBe('cancelled')

    const cancelled = await getJob(job!.id)
    expect(cancelled.status).toBe('cancelled')
    expect(c.s3).toBe(0)

    await expect(resumeJob(db, job!.id)).rejects.toThrow(QueueControlError)
  })
})

describe('сбой шага с повторами (этап 5: таймауты/повторы из конфига)', () => {
  it('шаг повторяется retries раз, затем задача failed, идея execution_status=error', { timeout: 10_000 }, async () => {
    const c = counters()
    let s2Calls = 0
    const worker = makeWorker(c, mainCheckpointer, {
      // eslint-disable-next-line ai-guard/no-async-without-await -- return type requires async
      t2: async () => {
        s2Calls++
        throw new Error('модель недоступна')
      },
    })

    const ideaId = await insertIdea('worker-сбой')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)

    const outcome = await worker.executeJob(job as JobRow)
    expect(outcome).toBe('failed')

    const failed = await getJob(job!.id)
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('s2')
    expect(failed.error).toContain('2 попыток')
    expect(s2Calls).toBe(2) // retries=1 → 2 попытки

    const idea = await db.orm.public.Ideas
      .select('executionStatus')
      .where(f => f.id.eq(ideaId))
      .first()
    expect(idea?.executionStatus).toBe('error')
  })
})

describe('повтор шага — rewind по чекпоинту (TZ §8)', () => {
  it('retryStep повторяет указанный шаг и последующие, предыдущие не выполняются заново', { timeout: 10_000 }, async () => {
    const c = counters()
    const worker = makeWorker(c, mainCheckpointer)

    const ideaId = await insertIdea('worker-retry-step')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)
    await worker.executeJob(job as JobRow)
    expect(c).toEqual({ s1: 1, s2: 1, s3: 1 })

    await retryStep(db, job!.id, 's2', steps)
    const rewound = await claimNextJob(db)
    expect(rewound?.id).toBe(job!.id)

    const outcome = await worker.executeJob(rewound as JobRow)
    if (outcome !== 'done') {
      const dbg = await getJob(job!.id)
      console.log('DEBUG rewind error:', dbg.error)
    }
    expect(outcome).toBe('done')
    expect(c).toEqual({ s1: 1, s2: 2, s3: 2 })
  })

  it('retryStep выполняющейся задачи запрещён', async () => {
    const ideaId = await insertIdea('worker-retry-running')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)
    await expect(retryStep(db, job!.id, 's1', steps)).rejects.toThrow(QueueControlError)
    await db.orm.public.QueueJobs
      .where(f => f.id.eq(job!.id))
      .update({ status: 'cancelled' })
  }, 10_000)
})

describe('смена приоритета (TZ §8)', () => {
  it('обновляет приоритет задачи и идеи', async () => {
    const ideaId = await insertIdea('worker-priority')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)

    const updated = await setJobPriority(db, job!.id, 'high')
    expect(updated.priority).toBe('high')

    const idea = await db.orm.public.Ideas
      .select('priority')
      .where(f => f.id.eq(ideaId))
      .first()
    expect(idea?.priority).toBe('high')
  })

  it('смена приоритета влияет на порядок очереди', async () => {
    const lowIdea = await insertIdea('prio-low', 'low')
    const highIdea = await insertIdea('prio-high', 'high')
    const { job: lowJob } = await enqueueIdeaAnalysis(db, lowIdea)
    await enqueueIdeaAnalysis(db, highIdea)

    await setJobPriority(db, lowJob.id, 'high')
    // lowIdea поставлена раньше, теперь тоже high → FIFO выбирает её первой
    const first = await claimNextJob(db)
    expect(first?.ideaId).toBe(lowIdea)
    const second = await claimNextJob(db)
    expect(second?.ideaId).toBe(highIdea)
  })
})

describe('цикл воркера start/stop', () => {
  it('start() подхватывает задачу из очереди сам, stop() завершает цикл', { timeout: 20_000 }, async () => {
    const c = counters()
    const worker = makeWorker(c, mainCheckpointer)
    const running = worker.start()

    const ideaId = await insertIdea('worker-loop')
    await enqueueIdeaAnalysis(db, ideaId)

    const deadline = Date.now() + 10_000
    let done = false
    while (Date.now() < deadline && !done) {
      const job = await db.orm.public.QueueJobs
        .select('status')
        .where(f => f.ideaId.eq(ideaId))
        .orderBy(f => f.enqueuedAt.desc())
        .first()
      if (job?.status === 'done') {
        done = true
      }
      else {
        await new Promise(r => setTimeout(r, 50))
      }
    }
    await worker.stop()
    await running
    expect(done).toBe(true)
  })
})

describe('материалы фазы — записываются по мере выполнения (TZ §4)', () => {
  async function activeOutputs(ideaId: string): Promise<Array<{ outdated: boolean, role: string }>> {
    return await db.orm.public.AgentOutputs
      .select('outdated', 'role')
      .where(f => f.ideaId.eq(ideaId))
      .where(f => f.outdated.eq(false))
      .all()
  }

  /** Отдельный поллер: `waitFor` в этом файле ждёт синхронный предикат, async-проверка
   * прошла бы мгновенно (Promise всегда truthy) и тест стал бы ложно-зелёным. */
  async function waitActiveOutputs(ideaId: string, min: number, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const rows = await activeOutputs(ideaId)
      if (rows.length >= min) {
        return rows
      }
      if (Date.now() > deadline) {
        throw new Error(`активных записей фаз меньше ${min} за ${timeoutMs} мс`)
      }
      await new Promise(r => setTimeout(r, 25))
    }
  }

  it('выход шага виден в agent_outputs до конца прогона', { timeout: 15_000 }, async () => {
    const c = counters()
    const gate = openBarrier()
    const worker = makeWorker(c, mainCheckpointer, { t2: barrierExec(gate, 's2') })
    const ideaId = await insertIdea('worker-материалы-вовремя')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)
    expect(job).toBeDefined()

    // s1 уже отработал, s2 держим на барьере: прогон НЕ завершён.
    const running = worker.executeJob(job as JobRow)
    await waitActiveOutputs(ideaId, 1)

    // До переноса записи в makeNode здесь был бы пустой список — ровно тот случай,
    // из-за которого проверяющий не увидел работу агентов: прогон упал на середине,
    // и отработавшие фазы исчезли вместе с ним.
    expect((await activeOutputs(ideaId)).map(o => o.role)).toEqual(['r1'])

    gate.release()
    expect(await running).toBe('done')
    expect((await activeOutputs(ideaId)).map(o => o.role).sort()).toEqual(['r1', 'r2', 'r3'])
  })

  it('самоизлечивается, если таблицы чекпоинтов снесли (migrate на деплое)', { timeout: 15_000 }, async () => {
    // Ровно то, что случилось на публичном стенде: `prisma db update` считает таблицы
    // LangGraph лишними и роняет их (замер: 4 destructive operation «Drop table»).
    // Проверка на живой БД: роняем и убеждаемся, что задание всё равно проходит.
    const ideaId = await insertIdea('worker-таблицы-снесены')
    await enqueueIdeaAnalysis(db, ideaId)
    const job = await claimNextJob(db)
    expect(job).toBeDefined()

    // Сырой SQL — через pg.Client, как в остальных местах этого файла: ORM контракта
    // эти таблицы не знает, именно поэтому migrate их и сносит.
    const client = new pg.Client({ connectionString: DB })
    await client.connect()
    try {
      await client.query('drop table if exists checkpoint_writes cascade; drop table if exists checkpoint_blobs cascade; drop table if exists checkpoints cascade; drop table if exists checkpoint_migrations cascade')
      expect(await makeWorker(counters(), mainCheckpointer).executeJob(job as JobRow)).toBe('done')
      const tables = await client.query(
        'select table_name from information_schema.tables where table_name like $1',
        ['checkpoint%'],
      )
      expect(tables.rows).toHaveLength(4)
    }
    finally {
      await client.end()
    }
  })

  it('повторный прогон не оставляет двух активных записей одной фазы', { timeout: 20_000 }, async () => {
    const c = counters()
    const ideaId = await insertIdea('worker-перезапись-фазы')
    await enqueueIdeaAnalysis(db, ideaId)
    await makeWorker(c, mainCheckpointer).executeJob(await claimNextJob(db) as JobRow)
    expect((await activeOutputs(ideaId)).length).toBe(3)

    await enqueueIdeaAnalysis(db, ideaId)
    await makeWorker(c, mainCheckpointer).executeJob(await claimNextJob(db) as JobRow)

    const all = await db.orm.public.AgentOutputs
      .select('outdated', 'role')
      .where(f => f.ideaId.eq(ideaId))
      .all() as unknown as Array<{ outdated: boolean, role: string }>

    // История прежнего прогона остаётся (устаревшей, но доступной), а активной
    // остаётся ровно одна запись каждой фазы — иначе «материалы» показывают лотерею.
    expect(all.length).toBe(6)
    expect(all.filter(o => !o.outdated).map(o => o.role).sort()).toEqual(['r1', 'r2', 'r3'])
  })
})
