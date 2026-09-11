import { setResponseHeader, setResponseStatus } from 'h3'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/jobs/:id/stream — SSE-поток обновлений статуса задачи
// Просвечивает БД каждые 2 сек, пушит при изменении currentStep или status.
export default defineEventHandler((event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))

  setResponseStatus(event, 200)
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const nodeRes = event.node.res

  let lastStep: string | null = null
  let lastStatus: string | null = null
  let closed = false

  function send(data: Record<string, unknown>): void {
    if (closed) return
    nodeRes.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  const interval = setInterval(() => {
    void (async () => {
      try {
        const job = await db.orm.public.QueueJobs
          .select('id', 'currentStep', 'status', 'error', 'startedAt', 'finishedAt')
          .where(f => f.id.eq(jobId))
          .first()

        if (!job) {
          send({ message: 'Задача не найдена', type: 'error' })
          return
        }

        const currentStep = (job as { currentStep?: string | null }).currentStep ?? null
        const status = (job as { status: string }).status
        const error = (job as { error?: string | null }).error ?? null

        if (currentStep !== lastStep || status !== lastStatus) {
          lastStep = currentStep
          lastStatus = status
          send({ currentStep, error, status, type: 'progress' })
        }

        if (['cancelled', 'done', 'failed'].includes(status)) {
          send({ status, type: 'done' })
          cleanup()
        }
      }
      catch {
        // DB error — повторим через 2 сек
      }
    })()
  }, 2000)

  function cleanup(): void {
    if (closed) return
    closed = true
    clearInterval(interval)
    if (!nodeRes.writableEnded) {
      nodeRes.end()
    }
  }

  nodeRes.on('close', cleanup)

  // Первый пинг чтобы клиент знал что соединение установлено
  send({ type: 'connected' })
})
