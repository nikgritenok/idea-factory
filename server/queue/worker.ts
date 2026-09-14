import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { log } from 'evlog'

import type { PipelineStep } from '../../config/pipeline'
import type { CheckpointerHandle } from './checkpointer'
import type { JobCheckpoint, JobRow, PrismaDb, StepExecutor } from './types'

import { PIPELINE_VERSION } from '../../config/pipeline'
import { ensureCheckpointerTables } from './checkpointer'
import { claimNextJob, type ClaimOptions, initialCheckpoint } from './claim'
import { getExecutor, hasOnlyFixtureExecutors } from './executors'
import { createRun } from './run-protocol'
import { findCheckpointBefore, runWithRetry, sleep } from './worker-utils'

const PipelineState = Annotation.Root({
  ideaId: Annotation<string>,
  jobId: Annotation<string>,
  pipelineVersion: Annotation<string>,
  runId: Annotation<string | undefined>({
    default: () => {},
    reducer: (a, b) => b ?? a,
  }),
  stepResults: Annotation<Record<string, unknown>>({
    default: () => ({}),
    reducer: (a, b) => ({ ...a, ...b }),
  }),
})

type PipelineStateT = typeof PipelineState.State

export interface WorkerOptions {
  checkpointer: CheckpointerHandle
  claim?: ClaimOptions
  /** Переопределение исполнителей (тесты, этап 5) — ключ = step.executor */
  executors?: Record<string, StepExecutor>
  pollIntervalMs?: number
  retryDelayMs?: number
  steps: readonly PipelineStep[]
}

export type JobOutcome = 'cancelled' | 'done' | 'failed' | 'paused'

/**
 * Постоянный воркер очереди анализа (TZ §8): один обработчик, состояние на сервере,
 * перезапуск продолжает с последнего корректного шага (чекпоинты LangGraph в Postgres).
 * Пауза/отмена проверяются на границе шагов.
 */
export class AnalysisWorker {
  private readonly db: PrismaDb
  private readonly opts: Required<Pick<WorkerOptions, 'pollIntervalMs' | 'retryDelayMs'>> & WorkerOptions
  private stopped = false
  private looping: null | Promise<void> = null
  /** Сигнал отмены текущей задачи — доставляется в исполняющийся шаг */
  private currentSignal: AbortSignal | null = null

  constructor(db: PrismaDb, opts: WorkerOptions) {
    this.db = db
    this.opts = { pollIntervalMs: 2000, retryDelayMs: 200, ...opts }
  }

  /** Запускает цикл обработки; возвращает промис, который резолвится после stop() */
  async start(): Promise<void> {
    if (this.looping) {
      await this.looping
      return
    }
    this.stopped = false
    this.looping = this.loop()
    await this.looping
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
      const interrupted = await claimNextJob(this.db, { ...this.opts.claim, resumeRunning: true })
      if (!interrupted) {
        break
      }
      await this.executeJob(interrupted)
    }

    while (!this.stopped) {
      const job = await claimNextJob(this.db, this.opts.claim)
      if (!job) {
        await sleep(this.opts.pollIntervalMs)
        continue
      }
      await this.executeJob(job)
    }
  }

  /** Обработка одной задачи: граф пайплайна с чекпоинтами и контролем паузы/отмены */
  async executeJob(job: JobRow): Promise<JobOutcome> {
    // Таблицы чекпоинтов создаёт LangGraph, а не наши миграции — и `migrate`-сервис
    // на деплое считает их лишними и сносит (замер: `prisma db update` планирует
    // 4 destructive operation «Drop table "checkpoints" …»). Поэтому убеждаемся,
    // что они есть, перед КАЖДЫМ заданием: идемпотентно (CREATE TABLE IF NOT EXISTS),
    // ~30 мс, и больше не важно, что раньше встанет — worker или migrate.
    await ensureCheckpointerTables(this.opts.checkpointer)

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
        return await this.replayFromCheckpoint(job, graph, target)
      }
    }

    // Создаём запись прогона (TZ §9) при начале задачи
    const isFixture = hasOnlyFixtureExecutors(this.opts.steps)
    const runId = cp.graph_started
      ? (cp as unknown as { runId?: string }).runId
      : await this.createRun(job, isFixture)

    // Возобновление после рестарта/паузы: продолжаем с последнего корректного шага
    const streamInput: null | PipelineStateT = cp.graph_started
      ? null
      : {
          ideaId: job.ideaId,
          jobId: job.id,
          pipelineVersion: PIPELINE_VERSION,
          runId,
          stepResults: {},
        }
    return await this.streamJob(job, graph, { ...config }, streamInput, runId)
  }

  /** Обычное исполнение/возобновление: поток событий шаг за шагом, пауза/отмена на границах */
  private async streamJob(
    job: JobRow,
    graph: ReturnType<AnalysisWorker['buildGraph']>,
    streamConfig: Record<string, unknown>,
    streamInput: null | PipelineStateT,
    runId?: string,
  ): Promise<JobOutcome> {
    const cp: JobCheckpoint = job.checkpoint ?? initialCheckpoint(job.id)
    const controller = new AbortController()
    this.currentSignal = controller.signal
    let controlPause = false
    let controlCancel = false
    let completedStep: null | string = null

    try {
      const stream = await graph.stream(streamInput, {
        ...streamConfig,
        signal: controller.signal,
        streamMode: 'updates',
      })
      for await (const update of stream) {
        const stepId = Object.keys(update)[0] ?? null
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
          // Завершаем прогон как failed
          if (runId) {
            const { finishRun } = await import('./run-protocol')
            await finishRun(runId, 'failed', error instanceof Error ? error.message : String(error))
          }
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
      // Завершаем прогон как failed при отмене
      if (runId) {
        const { finishRun } = await import('./run-protocol')
        await finishRun(runId, 'failed', 'Cancelled')
      }
      await this.markCancelled(job)
      return 'cancelled'
    }

    // Граф дошёл до конца — задача выполнена.
    // Материалы шагов уже в agent_outputs (пишутся по мере выполнения), здесь
    // остаётся только детерминированная сборка отчёта.
    await this.persistReport(job.ideaId, cp)

    // Завершаем прогон как completed
    if (runId) {
      const { finishRun } = await import('./run-protocol')
      await finishRun(runId, 'completed')
    }
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({
        checkpoint: { ...cp, graph_started: true, last_step: completedStep } satisfies JobCheckpoint,
        // error чистим обязательно: текст предыдущей попытки (например, 401 до
        // смены ключа) оставался в строке и после успешного завершённого прогона,
        // а карточкаideas показывала красный «Прогон остановился» над готовым отчётом.
        error: null,
        finishedAt: new Date().toISOString(),
        status: 'done',
      })
    await this.db.orm.public.Ideas
      .where(f => f.id.eq(job.ideaId))
      .update({
        // executionStatus обязан уйти из 'running' вместе с funnelStage: без этого
        // у идеи навсегда оставалось «идёт анализ» (в UI это видно на экране прогона
        // и в `/api/jobs/[id]`). У enum нет терминального значения, «не исполняется»
        // здесь = 'paused' — так же делают пути паузы, отмены и реплея ниже.
        executionStatus: 'paused',
        funnelStage: 'decision',
        updatedAt: new Date().toISOString(),
      })
    return 'done'
  }

  /**
   * Выход шага сохраняется сразу, как шаг отработал — а не в конце прогона.
   *
   * Пока этого не было, карточка идеи не показывала материалы, пока прогон не
   * доходил до последнего шага, а прогон, упавший на середине, не оставлял НИЧЕГО:
   * именно поэтому проверяющий увидел пустой «ход работы» там, где четыре фазы
   * уже отработали. Плюс персестарт по retry-step (replay) писал отчёт только
   * вместе с полным `persistResults`, которого на его пути не было.
   *
   * Устаревшим становится только ЭТА роль: материалы предыдущего прогона остаются
   * видны, пока шаг не переотработан, — иначе при сбое нового прогона пользователь
   * теряет то, что уже было получено.
   */
  private async persistStepOutput(
    ideaId: string,
    runId: string | undefined,
    step: PipelineStep,
    result: unknown,
  ): Promise<void> {
    const role = step.role ?? step.id
    try {
      await this.db.orm.public.AgentOutputs
        .where(f => f.ideaId.eq(ideaId))
        .where(f => f.role.eq(role))
        .update({ outdated: true })

      await this.db.orm.public.AgentOutputs.create({
        formatValid: true,
        ideaId,
        output: JSON.parse(JSON.stringify(result)),
        role,
        runId: runId ?? null,
      })
    }
    catch (err) {
      // Сбой записи материала не должен валить прогон: шаги уже оплачены LLM.
      // Стек сохраняем текстом — широкого события здесь нет, воркер вне HTTP-запроса.
      log.error({
        event: 'persist_step_failed',
        error: err instanceof Error ? err.stack ?? err.message : String(err),
        step: { id: step.id, role },
      })
    }
  }

  /** Отчёт собирается из шага критика; материалы к этому моменту уже сохранены по шагам. */
  private async persistReport(ideaId: string, cp: JobCheckpoint): Promise<void> {
    try {
      // Читаем финальное состояние из чекпоинтера
      const graph = this.buildGraph()
      const config = { configurable: { thread_id: cp.thread_id } }
      const snapshot = await graph.getState(config)
      const stepResults = (snapshot.values as { stepResults?: Record<string, unknown> })?.stepResults ?? {}

      // Собираем отчёт из critic_review (финальный шаг)
      const criticResult = stepResults['critic_review'] as Record<string, unknown> | undefined
      if (criticResult) {
        // Помечаем старые отчёты как outdated
        await this.db.orm.public.Reports
          .where(f => f.ideaId.eq(ideaId))
          .update({ outdated: true })

        // Данные критика могут быть вложены в { data: {...}, metadata: {...} }
        const nested = (criticResult as { data?: Record<string, unknown> })?.data ?? criticResult
        const rec = nested as {
          confidence?: string
          nextSteps?: string[]
          overallScore?: number
          reasoning?: string
          recommendation?: string
          score?: number
          stopFactors?: Array<{ description?: string, reason?: string, severity?: string, severityLow?: string, severityMedium?: string, severityHigh?: string, workaround?: string }>
          weaknesses?: Array<{ description?: string, mitigation?: string, severity?: string }>
        }
        const existing = await this.db.orm.public.Reports
          .where(f => f.ideaId.eq(ideaId))
          .orderBy(f => f.version.desc())
          .first()
        const nextVersion = existing ? ((existing as { version: number }).version + 1) : 1

        // Конвертируем 0–100 → 0–10 для UI
        const rawScore = rec.overallScore ?? rec.score ?? 0
        const scoreOutOf10 = Math.round((rawScore / 10) * 10) / 10

        // Трансформируем объект критика в массив {key, title, content} для UI
        const SECTION_LABELS: Record<string, string> = {
          confidence: 'Уверенность',
          nextSteps: 'Следующие шаги',
          overallScore: 'Общая оценка',
          reasoning: 'Обоснование',
          stopFactors: 'Стоп-факторы',
          weaknesses: 'Слабые места',
        }
        const sections = Object.entries(nested)
          .filter(([k]) => !['overallScore', 'recommendation', 'stopFactors'].includes(k))
          .map(([key, content]) => ({ content, key, title: SECTION_LABELS[key] ?? key }))

        await this.db.orm.public.Reports.create({
          ideaId,
          recommendation: rec.recommendation ?? null,
          score: String(scoreOutOf10),
          sections: JSON.parse(JSON.stringify(sections)),
          stopFactors: JSON.parse(JSON.stringify(rec.stopFactors ?? [])),
          version: nextVersion,
        })
      }
    }
    catch (err) {
      // Стек сохраняем текстом: воркер вне HTTP-запроса, широкого события с error.* здесь нет
      log.error({
        event: 'persist_results_failed',
        error: err instanceof Error ? err.stack ?? err.message : String(err),
      })
    }
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

    const lastStep = this.opts.steps.at(-1)?.id ?? null
    // Путь реплея обязан собрать отчёт сам: раньше он только помечал задачу done,
    // и «Продолжить прогон» после сбоя не оставлял ни отчёта, ни материалов.
    await this.persistReport(job.ideaId, { ...cp, graph_started: true, last_step: lastStep })
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({
        checkpoint: { ...cp, graph_started: true, last_step: lastStep } satisfies JobCheckpoint,
        // См. выше: завершённый прогон не имеет права нести ошибку прошлой попытки.
        error: null,
        finishedAt: new Date().toISOString(),
        status: 'done',
      })
    await this.db.orm.public.Ideas
      .where(f => f.id.eq(job.ideaId))
      .update({
        executionStatus: 'paused',
        updatedAt: new Date().toISOString(),
      })
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
    builder.addEdge(START, stepIds[0] as '__start__')
    for (let i = 0; i < stepIds.length - 1; i++) {
      builder.addEdge(stepIds[i] as '__start__', stepIds[i + 1] as '__start__')
    }
    builder.addEdge(stepIds.at(-1) as '__start__', END)
    return builder.compile({ checkpointer: this.opts.checkpointer.checkpointer })
  }

  private makeNode(step: PipelineStep, exec: StepExecutor) {
    return async (state: PipelineStateT): Promise<Pick<PipelineStateT, 'stepResults'>> => {
      const output = await runWithRetry(
        async () => await exec({
          db: this.db,
          ideaId: state.ideaId,
          jobId: state.jobId,
          signal: this.currentSignal ?? new AbortController().signal,
          state: { ...state.stepResults, runId: state.runId },
          step,
        }),
        step,
        this.opts.retryDelayMs,
      )
      // Материал фазы становится доступен сразу — не дождавшись конца прогона.
      await this.persistStepOutput(state.ideaId, state.runId, step, output.output)
      return { stepResults: { [step.id]: output.output } }
    }
  }

  private stepById(stepId: string): PipelineStep | undefined {
    return this.opts.steps.find(s => s.id === stepId)
  }

  private async readStatus(jobId: string): Promise<JobRow['status'] | undefined> {
    const row = await this.db.orm.public.QueueJobs
      .select('status')
      .where(f => f.id.eq(jobId))
      .first()
    return (row as { status: JobRow['status'] } | undefined)?.status
  }

  private async recordStepProgress(
    jobId: string,
    cp: JobCheckpoint,
    stepId: string,
    funnelStageAfter: PipelineStep['funnelStageAfter'],
  ): Promise<void> {
    const nextCp = { ...cp, graph_started: true, last_step: stepId } satisfies JobCheckpoint
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(jobId))
      .update({
        checkpoint: nextCp,
        currentStep: stepId,
      })

    // Обновляем идею: стадия + execution_status
    const job = await this.db.orm.public.QueueJobs
      .select('ideaId')
      .where(f => f.id.eq(jobId))
      .first()
    if (job) {
      const updateData: { funnelStage?: string, executionStatus: string, updatedAt: string } = {
        executionStatus: 'running',
        updatedAt: new Date().toISOString(),
      }
      if (funnelStageAfter) {
        updateData.funnelStage = funnelStageAfter
      }
      await this.db.orm.public.Ideas
        .where(f => f.id.eq(job.ideaId))
        .update(updateData)
    }
  }

  private async markPaused(job: JobRow, cp: JobCheckpoint): Promise<void> {
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({
        checkpoint: cp,
        status: 'paused',
      })
    await this.db.orm.public.Ideas
      .where(f => f.id.eq(job.ideaId))
      .update({
        executionStatus: 'paused',
        updatedAt: new Date().toISOString(),
      })
  }

  private async markCancelled(job: JobRow): Promise<void> {
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({
        finishedAt: new Date().toISOString(),
        status: 'cancelled',
      })
    await this.db.orm.public.Ideas
      .where(f => f.id.eq(job.ideaId))
      .update({
        executionStatus: 'paused',
        updatedAt: new Date().toISOString(),
      })
  }

  private async markFailed(
    job: JobRow,
    cp: JobCheckpoint,
    lastStep: null | string,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error)
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(job.id))
      .update({
        checkpoint: { ...cp, graph_started: true, last_step: lastStep } satisfies JobCheckpoint,
        error: message,
        finishedAt: new Date().toISOString(),
        status: 'failed',
      })
    await this.db.orm.public.Ideas
      .where(f => f.id.eq(job.ideaId))
      .update({
        executionStatus: 'error',
        updatedAt: new Date().toISOString(),
      })
  }

  /** Создаёт запись прогона (TZ §9) */
  private async createRun(job: JobRow, isFixture: boolean): Promise<string> {
    const componentVersions: Record<string, string> = {}
    for (const step of this.opts.steps) {
      componentVersions[step.role] = isFixture ? 'fixture' : 'z-ai/glm-5.3-flash'
    }

    return await createRun({
      componentVersions,
      configVersion: PIPELINE_VERSION,
      ideaId: job.ideaId,
      isFixture,
      variant: isFixture ? 'fixture' : 'llm',
    })
  }

  private async clearRewind(jobId: string, cp: JobCheckpoint): Promise<void> {
    const nextCp = { ...cp, rewind_to_step: null } satisfies JobCheckpoint
    await this.db.orm.public.QueueJobs
      .where(f => f.id.eq(jobId))
      .update({ checkpoint: nextCp })
  }
}
