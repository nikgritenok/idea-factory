import 'dotenv/config'
import { definePrismaConfig } from 'prisma/config'
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config'

// Файл читается Prisma CLI до старта Nuxt, поэтому runtimeConfig тут недоступен —
// проверка явная, с текстом ошибки вместо non-null утверждения.
const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new TypeError('DATABASE_URL не задан — prisma CLI не соберёт ORM (см. .env.example)')
}

export default definePrismaConfig({
  skills: {
    agents: ['agents'],
    check: true,
  },
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    db: {
      connection: databaseUrl,
    },
  }),
})
