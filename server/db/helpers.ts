import { execFileSync } from 'node:child_process'

/** Применить все миграции через dbmate */
export function applyMigrations(databaseUrl: string): void {
  const url = databaseUrl.includes('?') ? databaseUrl : `${databaseUrl}?sslmode=disable`
  execFileSync('dbmate', ['up'], {
    env: { ...process.env, DATABASE_URL: url },
    timeout: 30_000,
    stdio: 'pipe',
  })
}

/** Откатить последнюю миграцию через dbmate */
export function rollbackMigration(databaseUrl: string): void {
  const url = databaseUrl.includes('?') ? databaseUrl : `${databaseUrl}?sslmode=disable`
  execFileSync('dbmate', ['rollback'], {
    env: { ...process.env, DATABASE_URL: url },
    timeout: 30_000,
    stdio: 'pipe',
  })
}
