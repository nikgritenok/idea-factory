import { createError, useLogger } from 'evlog'
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
  const log = useLogger(event)
  const name = getRouterParam(event, 'name') ?? ''

  log.set({ doc: { known: Boolean(ALLOWED[name]), name: name || null } })

  const rel = ALLOWED[name]
  if (!rel) {
    throw createError({
      code: 'DOC_NOT_FOUND',
      fix: `Доступны документы: ${Object.keys(ALLOWED).join(', ')}`,
      message: 'Документ не найден',
      status: 404,
      why: `Имя «${name}» нет в allowlist разрешённых документов`,
    })
  }

  try {
    // Путь из ALLOWED-маппинга, не из пользовательского ввода — allowlist защищает от traversal
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- путь из фиксированного allowlist выше
    const content = readFileSync(join(process.cwd(), rel), 'utf8')
    setHeader(event, 'content-type', 'text/plain; charset=utf-8')
    log.set({ doc: { bytes: content.length, path: rel } })
    return content
  }
  catch (error) {
    // Файл есть в allowlist, но не читается — это дефект развертывания, а не запрос пользователя
    throw createError({
      cause: error instanceof Error ? error : undefined,
      code: 'DOC_UNREADABLE',
      fix: `Проверить, что ${rel} попал в образ (в Dokploy — пуш в main и пересборка)`,
      internal: { path: rel, reason: error instanceof Error ? error.message : String(error) },
      message: 'Файл документации недоступен',
      status: 404,
      why: 'Файл из allowlist не прочитался с диска',
    })
  }
})
