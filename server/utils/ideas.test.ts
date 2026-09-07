import { describe, it, expect, beforeAll } from 'vitest'
import postgres from 'postgres'
import { titleFromTranscript, countActiveIdeas, IDEA_LIMIT_ACTIVE } from './ideas'
import { migrateUp } from '../db/migrate'

const DB
  = process.env.TEST_DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test'

const sql = postgres(DB, { max: 5 })

beforeAll(async () => {
  await sql.unsafe('drop schema public cascade; create schema public;')
  await migrateUp(sql as unknown as never)
})

describe('titleFromTranscript', () => {
  it('первое предложение становится заголовком', () => {
    expect(
      titleFromTranscript('ИИ-разбор обращений. Клиенты ждут ответа быстрее.'),
    ).toBe('ИИ-разбор обращений')
  })

  it('длинный заголовок обрезается с многоточием', () => {
    const t = titleFromTranscript('а'.repeat(200))
    expect(t.length).toBe(120) // 119 символов + «…»
    expect(t.endsWith('…')).toBe(true)
  })

  it('пустой ввод даёт «Без названия»', () => {
    expect(titleFromTranscript('   ')).toBe('Без названия')
  })
})

describe('countActiveIdeas / лимит очереди (TZ §8)', () => {
  it('считает только не-архивные идеи', async () => {
    await sql`delete from ideas`
    for (let i = 0; i < 3; i++) {
      await sql`insert into ideas (title) values (${'t' + i})`
    }
    await sql`insert into ideas (title, funnel_stage) values ('arch', 'archived')`
    expect(await countActiveIdeas(sql as unknown as never)).toBe(3)
  })

  it('константа лимита = 10 (TZ §8)', () => {
    expect(IDEA_LIMIT_ACTIVE).toBe(10)
  })
})
