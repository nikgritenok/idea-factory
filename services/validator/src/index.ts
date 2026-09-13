import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import { ValidateRequestSchema } from './types'
import { validateRules } from './rules'

const PORT = 3001
const VERSION = '1.0.0'

/**
 * Микросервис-валидатор правил (TZ §1/§11).
 * Изолированный контейнер, HTTP-контракт: POST /validate, GET /version.
 * Без доступа к ключам оркестратора.
 */

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()))
      }
      catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function handleValidate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown
  try {
    body = await parseBody(req)
  }
  catch {
    sendJson(res, 400, { valid: false, errors: ['Некорректный JSON'] })
    return
  }

  // Базовая валидация через Zod (обязательные поля, допустимые значения)
  const parsed = ValidateRequestSchema.safeParse(body)
  if (!parsed.success) {
    sendJson(res, 400, {
      valid: false,
      errors: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
    })
    return
  }

  // Бизнес-правила (согласованность)
  const result = validateRules(parsed.data)
  sendJson(res, result.valid ? 200 : 422, result)
}

function handleVersion(_req: IncomingMessage, res: ServerResponse): void {
  sendJson(res, 200, { version: VERSION })
}

/** Обработчик запроса: отдельно от createServer, чтобы callback был синхронным (void-возврат) */
async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method === 'POST' && req.url === '/validate') {
      await handleValidate(req, res)
    }
    else if (req.method === 'GET' && req.url === '/version') {
      handleVersion(req, res)
    }
    else {
      sendJson(res, 404, { error: 'Not found' })
    }
  }
  catch (error) {
    console.error('Validator error:', error)
    sendJson(res, 500, { error: 'Internal server error' })
  }
}

const server = createServer((req, res) => {
  void handle(req, res)
})

server.listen(PORT, () => {
  console.log(`Validator v${VERSION} running on http://localhost:${PORT}`)
})
