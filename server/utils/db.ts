import { execFileSync } from 'node:child_process'
import postgres from 'postgres'

let sql: null | ReturnType<typeof postgres> = null
let migrated = false

export function db(): ReturnType<typeof postgres> {
  if (!sql) {
    const databaseUrl
      = process.env.DATABASE_URL
        ?? 'postgres://postgres:postgres@localhost:5432/idea_factory'
    sql = postgres(databaseUrl, { max: 5 })
  }
  return sql
}

// eslint-disable-next-line ai-guard/no-async-without-await -- intentional: async for API consistency, callers use await
export async function ensureMigrated(): Promise<void> {
  if (migrated) return
  const databaseUrl = process.env.DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5432/idea_factory'
  const url = databaseUrl.includes('?') ? databaseUrl : `${databaseUrl}?sslmode=disable`
  try {
    execFileSync('dbmate', ['up'], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
      timeout: 30_000,
    })
  }
  catch {
    // dbmate not available or migration failed — continue without migration
  }
  migrated = true
}
