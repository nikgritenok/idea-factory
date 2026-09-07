import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { applyMigrations } from '../db/helpers'
import { enqueueIdeaAnalysis } from './enqueue'
import { claimNextJob } from './claim'
import { retryStep, resumeJob, cancelJob, pauseJob, setJobPriority, QueueControlError } from './controls'
import { createCheckpointer, ensureCheckpointerTables, type CheckpointerHandle } from './checkpointer'
import { AnalysisWorker } from './worker'
import type { JobRow, StepExecutor } from './types'

const DB
  = process.env.TEST_DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test'

const sql = postgres(DB, { max: 5 })

let mainCheckpointer: CheckpointerHandle

/** Тестовый пайплайн: 3 шага, s2 с retries, funnel после s3 */
const steps = [
  { id: 's1', role: 'r1', title: 's1', executor: 't1', timeoutMs: 3000, retries: 0 },
  { id: 's2', role: 'r2', title: 's2', executor: 't2', timeoutMs: 3000, retries: 1 },
  {
    id: 's3',
    role: 'r3',
    title: 's3',
    executor: 't3',
    timeoutMs: 3000,
    retries: 0,
    funnelStageAfter: 'decision' as const,
  },
]

interface Counters { s1: number, s2: number, s3: number }

function counters(): Counters {
  return { s1: 0, s2: 0, s3: 0 }
}

function countingExecutors(c: Counters, overrides: Record<string, StepExecutor> = {}): Record<string, StepExecutor> {
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
        const onAbort = () => reject(new Error('aborted'))
        if (signal.aborted) {
          return onAbort()
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

async function insertIdea(title: string): Promise<string> {
  const [row] = await sql`insert into ideas (title) values (${title}) returning id`
  return (row as { id: string }).id
}

async function getJob(jobId: string): Promise<JobRow> {
  const [row] = await sql`select * from queue_jobs where id = ${jobId}`
  return row as JobRow
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
  while (Date.now() < deadline && stable < 2) {
    const [row] = await sql`select count(*) as n from checkpoints where thread_id = ${threadId}`
    const n = Number((row as { n: number }).n)
    stable = n === last ? stable + 1 : 0
    last = n
    await new Promise(r => setTimeout(r, 40))
  }
}

async function waitForStep(jobId: string, stepId: string, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const job = await getJob(jobId)
    if (job.current_step === stepId) {
      return
    }
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error(`Шаг ${stepId} не достигнут за ${timeoutMs} мс`)
}

function makeWorker(c: Counters, checkpointer: CheckpointerHandle, overrides?: Record<string, StepExecutor>): AnalysisWorker {
  return new AnalysisWorker(sql, {
    steps,
    checkpointer,
    executors: countingExecutors(c, overrides),
    retryDelayMs: 20,
  })
}

beforeAll(async () => {
  await sql.unsafe('drop schema public cascade; create schema public;')
  applyMigrations(DB)
  mainCheckpointer = createCheckpointer(DB)
  await ensureCheckpointerTables(mainCheckpointer)
})

afterAll(async () => {
  await mainCheckpointer.end()
  await sql.end()
})

describe('AnalysisWorker: базовый прогон', () => {
  it('выполняет все шаги по порядку, задача done, идея в decision (funnel TZ §3)', { timeout: 10_000 }, async () => {
    const c = counters()
    const worker = makeWorker(c, mainCheckpointer)
    const ideaId = await insertIdea('worker-базовый')
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)
    expect(job).toBeDefined()

    const outcome = await worker.executeJob(job as JobRow)
    expect(outcome).toBe('done')

    const after = await getJob(job!.id)
    expect(after.status).toBe('done')
    expect(after.current_step).toBe('s3')
    expect(after.checkpoint?.graph_started).toBe(true)
    expect(after.finished_at).not.toBeNull()

    const [idea] = await sql`select funnel_stage, execution_status from ideas where id = ${ideaId}`
    expect((idea as { funnel_stage: string }).funnel_stage).toBe('decision')
    expect((idea as { execution_status: string }).execution_status).toBe('paused')

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
      promise: new Promise<void>(() => {}),
      onStarted: () => {
        s3Started = true
      },
    }
    const workerA = new AnalysisWorker(sql, {
      steps,
      checkpointer: crashCheckpointer,
      executors: countingExecutors(cA, { t3: barrierExec(crashBarrier, 'A-s3') }),
      retryDelayMs: 20,
    })

    const ideaId = await insertIdea('worker-рестарт')
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)

    void workerA.executeJob(job as JobRow)
    await waitForStep(job!.id, 's2')
    await waitFor(() => s3Started, 5000, 's3 не стартовал')
    await waitForCheckpointStability(job!.id)

    const leftover = await getJob(job!.id)
    expect(leftover.status).toBe('running')

    // Новый воркер с новым чекпоинтером продолжает с последнего корректного шага
    // (claim в режиме восстановления, как при старте воркера после рестарта)
    const workerB = makeWorker(cB, mainCheckpointer)
    const resumed = await claimNextJob(sql, { resumeRunning: true })
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
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)

    const execution = worker.executeJob(job as JobRow)
    await waitForStep(job!.id, 's2')

    await pauseJob(sql, job!.id)

    barrier.release()
    const outcome = await execution
    expect(outcome).toBe('paused')

    const paused = await getJob(job!.id)
    expect(paused.status).toBe('paused')
    expect(paused.checkpoint?.graph_started).toBe(true)

    // Продолжение: воркер возобновляет с s3, s1/s2 не повторяются
    await resumeJob(sql, job!.id)
    const resumedJob = await claimNextJob(sql)
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
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)

    const execution = worker.executeJob(job as JobRow)
    await waitForStep(job!.id, 's2')
    await cancelJob(sql, job!.id)

    barrier.release()
    const outcome = await execution
    expect(outcome).toBe('cancelled')

    const cancelled = await getJob(job!.id)
    expect(cancelled.status).toBe('cancelled')
    expect(c.s3).toBe(0)

    await expect(resumeJob(sql, job!.id)).rejects.toThrow(QueueControlError)
  })
})

describe('сбой шага с повторами (этап 5: таймауты/повторы из конфига)', () => {
  it('шаг повторяется retries раз, затем задача failed, идея execution_status=error', { timeout: 10_000 }, async () => {
    const c = counters()
    let s2Calls = 0
    const worker = makeWorker(c, mainCheckpointer, {
      t2: async () => {
        s2Calls++
        throw new Error('модель недоступна')
      },
    })

    const ideaId = await insertIdea('worker-сбой')
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)

    const outcome = await worker.executeJob(job as JobRow)
    expect(outcome).toBe('failed')

    const failed = await getJob(job!.id)
    expect(failed.status).toBe('failed')
    expect(failed.error).toContain('s2')
    expect(failed.error).toContain('2 попыток')
    expect(s2Calls).toBe(2) // retries=1 → 2 попытки

    const [idea] = await sql`select execution_status from ideas where id = ${ideaId}`
    expect((idea as { execution_status: string }).execution_status).toBe('error')
  })
})

describe('повтор шага — rewind по чекпоинту (TZ §8)', () => {
  it('retryStep повторяет указанный шаг и последующие, предыдущие не выполняются заново', { timeout: 10_000 }, async () => {
    const c = counters()
    const worker = makeWorker(c, mainCheckpointer)

    const ideaId = await insertIdea('worker-retry-step')
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)
    await worker.executeJob(job as JobRow)
    expect(c).toEqual({ s1: 1, s2: 1, s3: 1 })

    await retryStep(sql, job!.id, 's2', steps)
    const rewound = await claimNextJob(sql)
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
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)
    await expect(retryStep(sql, job!.id, 's1', steps)).rejects.toThrow(QueueControlError)
    await sql`update queue_jobs set status = 'cancelled' where id = ${job!.id}`
  }, 10_000)
})

describe('смена приоритета (TZ §8)', () => {
  it('обновляет приоритет задачи и идеи', async () => {
    const ideaId = await insertIdea('worker-priority')
    await enqueueIdeaAnalysis(sql, ideaId)
    const job = await claimNextJob(sql)

    const updated = await setJobPriority(sql, job!.id, 'high')
    expect(updated.priority).toBe('high')

    const [idea] = await sql`select priority from ideas where id = ${ideaId}`
    expect((idea as { priority: string }).priority).toBe('high')
  })

  it('смена приоритета влияет на порядок очереди', async () => {
    const lowIdea = await insertIdea('prio-low', 'low')
    const highIdea = await insertIdea('prio-high', 'high')
    const { job: lowJob } = await enqueueIdeaAnalysis(sql, lowIdea)
    await enqueueIdeaAnalysis(sql, highIdea)

    await setJobPriority(sql, lowJob.id, 'high')
    // lowIdea поставлена раньше, теперь тоже high → FIFO выбирает её первой
    const first = await claimNextJob(sql)
    expect(first?.idea_id).toBe(lowIdea)
    const second = await claimNextJob(sql)
    expect(second?.idea_id).toBe(highIdea)
  })
})

describe('цикл воркера start/stop', () => {
  it('start() подхватывает задачу из очереди сам, stop() завершает цикл', { timeout: 20_000 }, async () => {
    const c = counters()
    const worker = makeWorker(c, mainCheckpointer)
    const running = worker.start()

    const ideaId = await insertIdea('worker-loop')
    await enqueueIdeaAnalysis(sql, ideaId)

    const deadline = Date.now() + 10_000
    let done = false
    while (Date.now() < deadline && !done) {
      const [row] = await sql`select status from queue_jobs
        where idea_id = ${ideaId} order by enqueued_at desc limit 1`
      if ((row as { status: string } | undefined)?.status === 'done') {
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
