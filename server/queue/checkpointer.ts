import { Pool } from 'pg'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'

/**
 * Чекпоинтер LangGraph в Postgres (PLAN: LangGraph.js checkpointing в Postgres).
 * Отдельный пул pg (чекпоинтер использует драйвер pg, приложение — postgres.js).
 */
export interface CheckpointerHandle {
  checkpointer: PostgresSaver
  end(): Promise<void>
}

export function createCheckpointer(databaseUrl?: string): CheckpointerHandle {
  const connectionString
    = databaseUrl
      ?? process.env.DATABASE_URL
      ?? 'postgres://postgres:postgres@localhost:5432/idea_factory'
  const pool = new Pool({ connectionString, max: 2 })
  const checkpointer = new PostgresSaver(pool)
  return {
    checkpointer,
    async end() {
      await pool.end()
    },
  }
}

/** setup() создаёт таблицы чекпоинтов при первом использовании (идемпотентно) */
export async function ensureCheckpointerTables(handle: CheckpointerHandle): Promise<void> {
  await handle.checkpointer.setup()
}
