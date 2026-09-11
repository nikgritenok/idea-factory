import { createEventStream } from 'h3'

import { db } from '../../../utils/db'
import { parseUuid } from '../../../utils/schemas'

// GET /api/jobs/:id/stream — SSE-поток обновлений статуса задачи
// Просвечивает БД каждые 2 сек, пушит при изменении currentStep или status.
export default defineEventHandler((event) => {
  const jobId = parseUuid(getRouterParam(event, 'id'))
  const eventStream = createEventStream(event)

  let lastStep: string | null = null
  let lastStatus: string | null = null

  const interval = setInterval(() => {
    void (async () => {
      try {
        const job = await db.orm.public.QueueJobs
          .select('id', 'currentStep', 'status', 'error', 'startedAt', 'finishedAt')
          .where(f => f.id.eq(jobId))
          .first()

        if (!job) {
          await eventStream.push(JSON.stringify({ message: 'Задача не найдена', type: 'error' }))
          return
        }

        const currentStep = (job as { currentStep?: string | null }).currentStep ?? null
        const status = (job as { status: string }).status
        const error = (job as { error?: string | null }).error ?? null

        // Пушим только при изменении
        if (currentStep !== lastStep || status !== lastStatus) {
          lastStep = currentStep
          lastStatus = status
          await eventStream.push(JSON.stringify({
            currentStep,
            error,
            status,
            type: 'progress',
          }))
        }

        // Завершаем поток если задача в терминальном статусе
        if (['cancelled', 'done', 'failed'].includes(status)) {
          clearInterval(interval)
          await eventStream.push(JSON.stringify({ status, type: 'done' }))
          await eventStream.close()
        }
      }
      catch {
        // DB error — не закрываем поток, повторим через 2 сек
      }
    })()
  }, 2000)

  eventStream.onClosed(() => {
    clearInterval(interval)
  })

  return eventStream
})
