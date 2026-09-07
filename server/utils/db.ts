import postgres from 'postgres'
import { execFileSync } from 'node:child_process'

let sql: ReturnType<typeof postgres> | null = null
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

export async function ensureMigrated(): Promise<void> {
  if (migrated) return
  const databaseUrl = process.env.DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5432/idea_factory'
  const url = databaseUrl.includes('?') ? databaseUrl : `${databaseUrl}?sslmode=disable`
  try {
    execFileSync('dbmate', ['up'], {
      env: { ...process.env, DATABASE_URL: url },
      timeout: 30_000,
      stdio: 'pipe',
    })
  }
  catch {
    // dbmate not available or migration failed — continue without migration
  }
  migrated = true
}
