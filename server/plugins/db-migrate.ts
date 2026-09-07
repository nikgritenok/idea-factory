import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export default defineNitroPlugin(async () => {
  if (process.env.RUN_MIGRATIONS !== 'true') return

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('[db] DATABASE_URL не задан — миграции пропущены')
    return
  }

  try {
    const { stderr, stdout } = await execFileAsync('dbmate', ['up'], {
      env: { ...process.env, DATABASE_URL: `${databaseUrl}?sslmode=disable` },
      timeout: 30_000,
    })
    if (stdout.trim()) console.log('[db]', stdout.trim())
    if (stderr.trim()) console.error('[db]', stderr.trim())
  }
  catch (error) {
    console.error('[db] ошибка миграций:', error instanceof Error ? error.message : error)
  }
})
