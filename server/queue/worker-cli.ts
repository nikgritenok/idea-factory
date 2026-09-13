import { initLogger, log } from 'evlog'

import { PIPELINE_STEPS } from '../../config/pipeline'
import { db } from '../utils/db'
import { createCheckpointer, ensureCheckpointerTables } from './checkpointer'
import { AnalysisWorker } from './worker'

/**
 * CLI постоянного воркера (TZ §8): один обработчик, продолжающий очередь.
 * Использование: pnpm run worker (DATABASE_URL из окружения, см. .env.example).
 */

// Воркер вне HTTP-запроса: Nitro-плагин evlog здесь не работает, поэтому initLogger
// вызывается один раз при старте — иначе log.* пишется с дефолтным окружением без service.
initLogger({ env: { service: 'idea-factory-worker' } })

async function main(): Promise<void> {
  const handle = createCheckpointer()
  await ensureCheckpointerTables(handle)

  const worker = new AnalysisWorker(db, { checkpointer: handle, steps: PIPELINE_STEPS })
  const loop = worker.start()

  const shutdown = async (signal: string): Promise<void> => {
    log.info('worker', `${signal}: останавливаюсь после текущей задачи`)
    await worker.stop()
    await loop
    await handle.end()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  log.info('worker', 'запущен, жду задачи из очереди (Ctrl+C — остановка)')
}

main().catch((error) => {
  log.error({
    event: 'worker_boot_failed',
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })
  process.exit(1)
})
