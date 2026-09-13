import 'dotenv/config'
import { definePrismaConfig } from 'prisma/config'
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config'

// Файл читается Prisma CLI до старта Nuxt, поэтому runtimeConfig тут недоступен.
// DATABASE_URL на стадии Docker build отсутствует (.env в образ не копируется) —
// бросать здесь исключение нельзя: это роняет `pnpm run postinstall` и весь build
// (проверено падением деплойки 2026-09-13). Пустая строка на build'е безвредна:
// `skills sync` базу не трогает; на рантайме URL приходит из окружения compose.
const databaseUrl = process.env['DATABASE_URL'] ?? ''

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
