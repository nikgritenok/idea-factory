import 'dotenv/config'
import postgres from '@prisma/orm-postgres/runtime'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { beforeAll, describe, expect, it } from 'vitest'

import type { Contract } from '../../src/prisma/contract.d'

import contractJson from '../../src/prisma/contract.json' with { type: 'json' }
import { countActiveIdeas, IDEA_LIMIT_ACTIVE, titleFromTranscript } from './ideas'

const DB
  = process.env.TEST_DATABASE_URL
    ?? 'postgres://postgres:postgres@localhost:5434/idea_factory_test'

const db = postgres<Contract>({ contractJson, url: DB })

async function applyMigrations(dbUrl: string): Promise<void> {
  const raw = readFileSync(resolve(import.meta.dirname, '../../db/migrations/20260907000000_initial.sql'), 'utf8')
  const parts = raw.split('-- migrate:down')
  const up = (parts[0] ?? '').replace('-- migrate:up', '')
  const idempotent = up
    .replaceAll('create table ', 'create table if not exists ')
    .replaceAll('create index ', 'create index if not exists ')
  const client = new pg.Pool({ connectionString: dbUrl })
  try {
    await client.query(idempotent)
  }
  finally {
    await client.end()
  }
}

beforeAll(async () => {
  await applyMigrations(DB)
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
    // Delete all ideas, insert test data, then verify count
    const allIdeas = await db.orm.public.Ideas.select('id').all()
    for (const idea of allIdeas) {
      await db.orm.public.Ideas.where(f => f.id.eq(idea.id)).delete()
    }

    for (let i = 0; i < 3; i++) {
      await db.orm.public.Ideas.create({ title: `t${i}` })
    }
    await db.orm.public.Ideas.create({ funnelStage: 'archived', title: 'arch' })

    expect(await countActiveIdeas()).toBe(3)
  })

  it('константа лимита = 10 (TZ §8)', () => {
    expect(IDEA_LIMIT_ACTIVE).toBe(10)
  })
})
