import { migrateUp, migrateDown, getSql, appliedMigrations } from './migrate'

const command = process.argv[2] ?? 'up'
const sql = getSql()

try {
  if (command === 'up') {
    const applied = await migrateUp(sql)
    console.log('applied:', applied.length ? applied : '(none)')
  }
  else if (command === 'down') {
    const reverted = await migrateDown(sql, 1)
    console.log('reverted:', reverted.length ? reverted : '(none)')
  }
  else if (command === 'status') {
    console.log(await appliedMigrations(sql))
  }
  else {
    console.error('usage: migrate-cli.ts [up|down|status]')
    process.exitCode = 1
  }
}
finally {
  await sql.end()
}
