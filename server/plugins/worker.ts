import { PIPELINE_STEPS } from '../../config/pipeline'
import { createCheckpointer } from '../queue/checkpointer'
import { AnalysisWorker } from '../queue/worker'

// Nitro-плагин постоянного воркера (TZ §8): состояние на сервере, закрытие
// вкладки не останавливает выполнение. Запускается только при WORKER_MODE=true
// (docker-compose сервис worker), web-процесс очередь не обрабатывает.
export default defineNitroPlugin(async () => {
  if (process.env.WORKER_MODE !== 'true') {
    return
  }

  const { db } = await import('../utils/db')

  const handle = createCheckpointer()
  const worker = new AnalysisWorker(db, { checkpointer: handle, steps: PIPELINE_STEPS })

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal}: останавливаюсь после текущей задачи`)
    await worker.stop()
    await handle.end()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  console.log('[worker] WORKER_MODE=true — обработчик очереди запущен')
  // eslint-disable-next-line promise/prefer-await-to-then -- fire-and-forget with error logging
  void worker.start().catch(async (error) => {
    console.error('[worker] цикл обработки упал:', error)
    await handle.end()
    process.exit(1)
  })
})
