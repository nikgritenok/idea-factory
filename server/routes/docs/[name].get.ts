import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// GET /docs/:name — открытие документации репозитория из сервиса (TZ §13).
// Отдаём markdown как text/plain — содержимое репозитория, не исполняемое.

const ALLOWED: Record<string, string> = {
  ARCHITECTURE: 'docs/ARCHITECTURE.md',
  CONVENTIONS: 'docs/conventions.md',
  DEVLOG: 'DEVLOG.md',
  TZ: 'TZ.md',
}

export default defineEventHandler((event) => {
  const name = getRouterParam(event, 'name') ?? ''
  const rel = ALLOWED[name]
  if (!rel) {
    throw createError({ statusCode: 404, statusMessage: 'Документ не найден' })
  }

  try {
    // Путь из ALLOWED-маппинга, не из пользовательского ввода — allowlist защищает от traversal
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- путь из фиксированного allowlist выше
    const content = readFileSync(join(process.cwd(), rel), 'utf8')
    setHeader(event, 'content-type', 'text/plain; charset=utf-8')
    return content
  }
  catch {
    throw createError({ statusCode: 404, statusMessage: 'Файл документации недоступен' })
  }
})
