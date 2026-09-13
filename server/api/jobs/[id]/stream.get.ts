import { useLogger } from 'evlog'
import { setResponseHeader, setResponseStatus } from 'h3'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/jobs/:id/stream — SSE-поток обновлений статуса задачи
// Просвечивает БД каждые 2 сек, пушит при изменении currentStep или status.
//
// Широкое событие этого запроса эмитится на ЗАКРЫТИИ потока: SSE держит соединение
// открытым, поэтому в логе оно появится одной строкой за всю жизнь подписки, с итоговой
// durationMs. Логгер после emit запечатан (в Nuxt-интеграции нет log.fork), так что
// log.set() внутри setInterval ниже — не писать: значения молча потеряются с warning'ом.
export default defineEventHandler((event) => {
  const log = useLogger(event)
  const jobId = parseUuid(getRouterParam(event, 'id'))

  log.set({ job: { id: jobId, stream: true } })

  setResponseStatus(event, 200)
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  const nodeRes = event.node.res

  let lastStep: null | string = null
  let lastStatus: null | string = null
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

        const currentStep = (job as { currentStep?: null | string }).currentStep ?? null
        const status = (job as { status: string }).status
        const error = (job as { error?: null | string }).error ?? null

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
