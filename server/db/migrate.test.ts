import { describe, it, expect } from 'vitest'
import { migrateUp, migrateDown, appliedMigrations, getSql } from './migrate'

const DB = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test'

let sql = getSql(DB)

async function resetDb() {
  await sql.unsafe('drop schema public cascade; create schema public;')
}

beforeAll(async () => {
  await resetDb()
})

afterAll(async () => {
  await sql.end()
})

describe('migrations', () => {
  it('up применяет миграции и создаёт таблицы', async () => {
    const applied = await migrateUp(sql)
    expect(applied).toContain('0001_initial.up.sql')

    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`
    const names = tables.map(t => t.table_name)
    for (const t of [
      'ideas', 'idea_versions', 'audio_files', 'sources',
      'agent_outputs', 'runs', 'run_calls', 'datasets',
      'calculations', 'reports', 'queue_jobs', 'config_versions',
    ]) {
      expect(names).toContain(t)
    }
  })

  it('down откатывает миграции и удаляет таблицы', async () => {
    const reverted = await migrateDown(sql, 1)
    expect(reverted).toEqual(['0001_initial.up.sql'])
    const tables = await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`
    const names = tables.map(t => t.table_name)
    expect(names).not.toContain('ideas')
    expect(names).not.toContain('queue_jobs')
  })

  it('up не применяет down-файлы как миграции', async () => {
    // идёт после down-теста: up накатывает 0001, но down-файл в журнале не появляется
    const applied = await migrateUp(sql)
    expect(applied).toEqual(['0001_initial.up.sql'])
    const journal = await appliedMigrations(sql)
    expect(journal).toEqual(['0001_initial.up.sql'])
  })

  it('повторный up после down накатывает заново (idempotent по журналу)', async () => {
    await migrateUp(sql)
    const applied = await migrateUp(sql)
    expect(applied).toEqual([])
  })
})

describe('data durability', () => {
  it('данные переживают рестарт (закрытие и новое подключение)', async () => {
    await sql`
      insert into ideas (title, priority, funnel_stage)
      values ('Идея-переживает-рестарт', 'high', 'draft')`

    await sql.end()
    sql = getSql(DB)

    const rows = await sql`select title from ideas where title = 'Идея-переживает-рестарт'`
    expect(rows).toHaveLength(1)
  })

  it('констрейнты воронки и приоритетов работают', async () => {
    await expect(
      sql`insert into ideas (title, funnel_stage) values ('bad', 'nonsense')`,
    ).rejects.toThrow()
    await expect(
      sql`insert into ideas (title, priority) values ('bad', 'urgent')`,
    ).rejects.toThrow()
  })

  it('каскадное удаление идеи удаляет версии, аудио, прогоны', async () => {
    const [idea] = await sql`
      insert into ideas (title) values ('cascade-test') returning id`
    await sql`insert into idea_versions (idea_id, version, snapshot) values (${idea.id}, 1, '{}')`
    await sql`insert into audio_files (idea_id, storage_path, mime_type) values (${idea.id}, '/tmp/a.webm', 'audio/webm')`
    await sql`insert into runs (idea_id, variant) values (${idea.id}, 'baseline')`

    await sql`delete from ideas where id = ${idea.id}`
    const counts = await sql`
      select
        (select count(*) from idea_versions where idea_id = ${idea.id}) as v,
        (select count(*) from audio_files where idea_id = ${idea.id}) as a,
        (select count(*) from runs where idea_id = ${idea.id}) as r`
    expect(Number(counts[0].v)).toBe(0)
    expect(Number(counts[0].a)).toBe(0)
    expect(Number(counts[0].r)).toBe(0)
  })
})
