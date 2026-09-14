import { log } from 'evlog'

import { PIPELINE_STEPS } from '../../config/pipeline'
import { createCheckpointer, ensureCheckpointerTables } from '../queue/checkpointer'
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
  // Таблицы чекпоинтов обязаны появиться ДО первого взятого задания. `worker-cli.ts`
  // это делал, а Nitro-плагин — нет, и на публичном стенде (где воркер живёт как
  // сервис `worker`, а не как CLI) любой прогон падал на первом же шаге:
  // relation "public.checkpoints" does not exist. Мерка: прогон id 8979a507 на стенде.
  await ensureCheckpointerTables(handle)
  const worker = new AnalysisWorker(db, { checkpointer: handle, steps: PIPELINE_STEPS })

  const shutdown = async (signal: string): Promise<void> => {
    log.info('worker', `${signal}: останавливаюсь после текущей задачи`)
    await worker.stop()
    await handle.end()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  log.info('worker', 'WORKER_MODE=true — обработчик очереди запущен')
  // eslint-disable-next-line promise/prefer-await-to-then -- fire-and-forget with error logging
  void worker.start().catch((error: unknown) => {
    log.error({
      event: 'worker_loop_failed',
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    })
    void handle.end()
    process.exit(1)
  })
})
