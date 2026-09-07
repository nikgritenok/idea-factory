import { PIPELINE_STEPS } from '../../config/pipeline'
import { db, ensureMigrated } from '../utils/db'
import { createCheckpointer, ensureCheckpointerTables } from './checkpointer'
import { AnalysisWorker } from './worker'

/**
 * CLI постоянного воркера (TZ §8): один обработчик, продолжающий очередь.
 * Использование: pnpm run worker (DATABASE_URL из окружения, см. .env.example).
 */
async function main(): Promise<void> {
  await ensureMigrated()

  const handle = createCheckpointer()
  await ensureCheckpointerTables(handle)

  const worker = new AnalysisWorker(db(), { steps: PIPELINE_STEPS, checkpointer: handle })
  const loop = worker.start()

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal}: останавливаюсь после текущей задачи`)
    await worker.stop()
    await loop
    await handle.end()
    process.exit(0)
  }
  process.once('SIGINT', () => void shutdown('SIGINT'))
  process.once('SIGTERM', () => void shutdown('SIGTERM'))

  console.log('[worker] запущен, жду задачи из очереди (Ctrl+C — остановка)')
}

// eslint-disable-next-line promise/prefer-await-to-callbacks
main().catch((error) => {
  console.error('[worker] не удалось запуститься:', error)
  process.exit(1)
})
