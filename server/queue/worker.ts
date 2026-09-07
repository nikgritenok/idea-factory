import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import type { Sql } from '../db/types'
import type { PipelineStep } from '../../config/pipeline'
import { PIPELINE_VERSION } from '../../config/pipeline'
import { claimNextJob, initialCheckpoint, type ClaimOptions } from './claim'
import { getExecutor } from './executors'
import type { CheckpointerHandle } from './checkpointer'
import type { JobCheckpoint, JobRow, StepExecutor } from './types'

const PipelineState = Annotation.Root({
  ideaId: Annotation<string>,
  jobId: Annotation<string>,
  pipelineVersion: Annotation<string>,
  stepResults: Annotation<Record<string, unknown>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
})

type PipelineStateT = typeof PipelineState.State

export interface WorkerOptions {
  steps: readonly PipelineStep[]
  checkpointer: CheckpointerHandle
  /** Переопределение исполнителей (тесты, этап 5) — ключ = step.executor */
  executors?: Record<string, StepExecutor>
  pollIntervalMs?: number
  claim?: ClaimOptions
  retryDelayMs?: number
}

export type JobOutcome = 'done' | 'paused' | 'cancelled' | 'failed'

/**
 * Постоянный воркер очереди анализа (TZ §8): один обработчик, состояние на сервере,
 * перезапуск продолжает с последнего корректного шага (чекпоинты LangGraph в Postgres).
 * Пауза/отмена проверяются на границе шагов.
 */
export class AnalysisWorker {
  private readonly sql: Sql
  private readonly opts: Required<Pick<WorkerOptions, 'pollIntervalMs' | 'retryDelayMs'>> & WorkerOptions
  private stopped = false
  private looping: Promise<void> | null = null
  /** Сигнал отмены текущей задачи — доставляется в исполняющийся шаг */
  private currentSignal: AbortSignal | null = null

  constructor(sql: Sql, opts: WorkerOptions) {
    this.sql = sql
    this.opts = { pollIntervalMs: 2000, retryDelayMs: 200, ...opts }
  }

  /** Запускает цикл обработки; возвращает промис, который резолвится после stop() */
  start(): Promise<void> {
    if (this.looping) {
      return this.looping
    }
    this.stopped = false
    this.looping = this.loop()
    return this.looping
  }

  /** Останавливает приём новых задач; текущая задача завершается до конца шага-цикла */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.looping) {
      await this.looping
      this.looping = null
    }
  }

  private async loop(): Promise<void> {
    await this.opts.checkpointer.checkpointer.setup()

    // Восстановление после рестарта (TZ §8): продолжаем прерванные задачи
    // с последнего корректного шага, не с нуля
    for (let i = 0; i < 50 && !this.stopped; i++) {
      const interrupted = await claimNextJob(this.sql, { ...this.opts.claim, resumeRunning: true })
      if (!interrupted) {
        break
      }
      await this.executeJob(interrupted)
    }

    while (!this.stopped) {
      const job = await claimNextJob(this.sql, this.opts.claim)
      if (!job) {
        await sleep(this.opts.pollIntervalMs)
        continue
      }
      await this.executeJob(job)
    }
  }

  /** Обработка одной задачи: граф пайплайна с чекпоинтами и контролем паузы/отмены */
  async executeJob(job: JobRow): Promise<JobOutcome> {
    const graph = this.buildGraph()
    const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(job.id)
    const config = { configurable: { thread_id: cp.thread_id } }

    // Управление до старта графа: пауза/отмена учтены сразу
    const preStatus = await this.readStatus(job.id)
    if (preStatus === 'paused') {
      await this.markPaused(job, cp)
      return 'paused'
    }
    if (preStatus === 'cancelled') {
      await this.markCancelled(job)
      return 'cancelled'
    }

    // Повтор шага (TZ §8): откат к checkpoint перед указанным шагом.
    // Time-travel replay — задокументированный invoke(null, config исторического
    // checkpoint); шаг и все последующие выполнятся заново.
    if (cp.rewind_to_step) {
      const target = await findCheckpointBefore(graph, cp.thread_id, cp.rewind_to_step)
      await this.clearRewind(job.id, cp)
      if (target) {
        return this.replayFromCheckpoint(job, graph, target)
      }
    }

    // Возобновление после рестарта/паузы: продолжаем с последнего корректного шага
    const streamInput: PipelineStateT | null = cp.graph_started
      ? null
      : {
          ideaId: job.idea_id,
          jobId: job.id,
          pipelineVersion: PIPELINE_VERSION,
          stepResults: {},
        }
    return this.streamJob(job, graph, { ...config }, streamInput)
  }

  /** Обычное исполнение/возобновление: поток событий шаг за шагом, пауза/отмена на границах */
  private async streamJob(
    job: JobRow,
    graph: ReturnType<AnalysisWorker['buildGraph']>,
    streamConfig: Record<string, unknown>,
    streamInput: PipelineStateT | null,
  ): Promise<JobOutcome> {
    const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(job.id)
    const controller = new AbortController()
    this.currentSignal = controller.signal
    let controlPause = false
    let controlCancel = false
    let completedStep: string | null = null

    try {
      const stream = await graph.stream(streamInput, {
        ...streamConfig,
        streamMode: 'updates',
        signal: controller.signal,
      })
      for await (const update of stream) {
        const stepId = Object.keys(update as Record<string, unknown>)[0] ?? null
        if (stepId) {
          completedStep = stepId
          const step = this.stepById(stepId)
          await this.recordStepProgress(job.id, cp, stepId, step?.funnelStageAfter)
        }
        // Пауза/отмена — на границе шагов
        const status = await this.readStatus(job.id)
        if (status === 'paused') {
          controlPause = true
          controller.abort()
          break
        }
        if (status === 'cancelled') {
          controlCancel = true
          controller.abort()
          break
        }
      }
    }
    catch (error) {
      // Управляющая отмена уже классифицирована флагами; остальные — сбой
      if (!controlPause && !controlCancel) {
        const status = await this.readStatus(job.id)
        if (status === 'cancelled') {
          controlCancel = true
        }
        else {
          await this.markFailed(job, cp, completedStep, error)
          return 'failed'
        }
      }
    }

    if (controlPause) {
      await this.markPaused(job, { ...cp, graph_started: true, last_step: completedStep })
      return 'paused'
    }
    if (controlCancel) {
      await this.markCancelled(job)
      return 'cancelled'
    }

    // Граф дошёл до конца — задача выполнена
    await this.sql`
      update queue_jobs
      set status = 'done', finished_at = now(), checkpoint = ${this.sql.json({ ...cp, graph_started: true, last_step: completedStep } satisfies JobCheckpoint)}
      where id = ${job.id}`
    await this.sql`
      update ideas
      set execution_status = 'paused', updated_at = now()
      where id = ${job.idea_id}`
    return 'done'
  }

  /**
   * Повтор шага: time-travel replay от исторического checkpoint
   * (документированный сценарий LangGraph: invoke(null, config снимка)).
   * Прогресс шагов после replay обновляется пост-фактум; контроль паузы/отмены
   * внутри replay недоступен — проверяется по завершении.
   */
  private async replayFromCheckpoint(
    job: JobRow,
    graph: ReturnType<AnalysisWorker['buildGraph']>,
    historicalConfig: Record<string, unknown>,
  ): Promise<JobOutcome> {
    const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(job.id)
    const controller = new AbortController()
    this.currentSignal = controller.signal
    try {
      await graph.invoke(null, { ...historicalConfig, signal: controller.signal })
    }
    catch (error) {
      const status = await this.readStatus(job.id)
      if (status === 'cancelled') {
        await this.markCancelled(job)
        return 'cancelled'
      }
      await this.markFailed(job, cp, cp.last_step, error)
      return 'failed'
    }

    const lastStep = this.opts.steps[this.opts.steps.length - 1]?.id ?? null
    await this.sql`
      update queue_jobs
      set status = 'done', finished_at = now(), checkpoint = ${this.sql.json({ ...cp, graph_started: true, last_step: lastStep } satisfies JobCheckpoint)}
      where id = ${job.id}`
    await this.sql`
      update ideas
      set execution_status = 'paused', updated_at = now()
      where id = ${job.idea_id}`
    return 'done'
  }

  private buildGraph() {
    const builder = new StateGraph(PipelineState)
    const stepIds: string[] = []
    for (const step of this.opts.steps) {
      const exec = this.opts.executors?.[step.executor] ?? getExecutor(step.executor)
      builder.addNode(step.id, this.makeNode(step, exec))
      stepIds.push(step.id)
    }
    builder.addEdge(START, stepIds[0] as string)
    for (let i = 0; i < stepIds.length - 1; i++) {
      builder.addEdge(stepIds[i] as string, stepIds[i + 1] as string)
    }
    builder.addEdge(stepIds[stepIds.length - 1] as string, END)
    return builder.compile({ checkpointer: this.opts.checkpointer.checkpointer })
  }

  private makeNode(step: PipelineStep, exec: StepExecutor) {
    return async (state: PipelineStateT): Promise<Pick<PipelineStateT, 'stepResults'>> => {
      const output = await runWithRetry(
        () => exec({
          sql: this.sql,
          ideaId: state.ideaId,
          jobId: state.jobId,
          step,
          state: state.stepResults,
          signal: this.currentSignal ?? new AbortController().signal,
        }),
        step,
        this.opts.retryDelayMs,
      )
      return { stepResults: { [step.id]: output.output } }
    }
  }

  private stepById(stepId: string): PipelineStep | undefined {
    return this.opts.steps.find(s => s.id === stepId)
  }

  private async readStatus(jobId: string): Promise<JobRow['status'] | undefined> {
    const [row] = await this.sql`
      select status from queue_jobs where id = ${jobId}`
    return (row as { status: JobRow['status'] } | undefined)?.status
  }

  private async recordStepProgress(
    jobId: string,
    cp: JobCheckpoint,
    stepId: string,
    funnelStageAfter: PipelineStep['funnelStageAfter'],
  ): Promise<void> {
    const nextCp = { ...cp, graph_started: true, last_step: stepId } satisfies JobCheckpoint
    await this.sql`
      update queue_jobs
      set current_step = ${stepId}, checkpoint = ${this.sql.json(nextCp)}
      where id = ${jobId}`
    if (funnelStageAfter) {
      await this.sql`
        update ideas
        set funnel_stage = ${funnelStageAfter}, execution_status = 'running', updated_at = now()
        where id = (select idea_id from queue_jobs where id = ${jobId})`
    }
    else {
      await this.sql`
        update ideas
        set execution_status = 'running', updated_at = now()
        where id = (select idea_id from queue_jobs where id = ${jobId})`
    }
  }

  private async markPaused(job: JobRow, cp: JobCheckpoint): Promise<void> {
    await this.sql`
      update queue_jobs set status = 'paused', checkpoint = ${this.sql.json(cp)} where id = ${job.id}`
    await this.sql`
      update ideas set execution_status = 'paused', updated_at = now() where id = ${job.idea_id}`
  }

  private async markCancelled(job: JobRow): Promise<void> {
    await this.sql`
      update queue_jobs set status = 'cancelled', finished_at = now() where id = ${job.id}`
    await this.sql`
      update ideas set execution_status = 'paused', updated_at = now() where id = ${job.idea_id}`
  }

  private async markFailed(
    job: JobRow,
    cp: JobCheckpoint,
    lastStep: string | null,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await this.sql`
      update queue_jobs
      set status = 'failed', finished_at = now(), error = ${message},
          checkpoint = ${this.sql.json({ ...cp, graph_started: true, last_step: lastStep } satisfies JobCheckpoint)}
      where id = ${job.id}`
    await this.sql`
      update ideas set execution_status = 'error', updated_at = now() where id = ${job.idea_id}`
  }

  private async clearRewind(jobId: string, cp: JobCheckpoint): Promise<void> {
    const nextCp = { ...cp, rewind_to_step: null } satisfies JobCheckpoint
    await this.sql`
      update queue_jobs set checkpoint = ${this.sql.json(nextCp)} where id = ${jobId}`
  }
}

async function runWithRetry(
  fn: () => Promise<{ output: unknown }>,
  step: PipelineStep,
  retryDelayMs: number,
): Promise<{ output: unknown }> {
  let lastError: unknown
  for (let attempt = 0; attempt <= step.retries; attempt++) {
    try {
      return await withTimeout(fn(), step.timeoutMs)
    }
    catch (error) {
      lastError = error
      if (attempt < step.retries) {
        await sleep(retryDelayMs)
      }
    }
  }
  throw lastError instanceof Error
    ? new Error(`Шаг «${step.id}» не выполнен после ${step.retries + 1} попыток: ${lastError.message}`, { cause: lastError })
    : lastError
}

function withTimeout(p: Promise<{ output: unknown }>, timeoutMs: number): Promise<{ output: unknown }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Таймаут шага ${timeoutMs} мс`)),
      timeoutMs,
    )
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** История чекпоинтов: находит snapshot, из которого шаг выполнится повторно */
async function findCheckpointBefore(
  graph: { getStateHistory(config: unknown): AsyncIterable<{ next: readonly string[], config: Record<string, unknown> }> },
  threadId: string,
  stepId: string,
): Promise<Record<string, unknown> | undefined> {
  const config = { configurable: { thread_id: threadId } }
  for await (const snapshot of graph.getStateHistory(config)) {
    if (snapshot.next.includes(stepId)) {
      return snapshot.config
    }
  }
  return undefined
}
