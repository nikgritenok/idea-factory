import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const ROUTERAI_BASE = 'https://routerai.ru/api/v1'
export const STT_MODEL = 'microsoft/mai-transcribe-2'

export interface TranscribeResult {
  cost: number
  durationSec: number
  text: string
}

export class SttError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
  }
}

async function convertWebmToWav(inputBuffer: Buffer): Promise<Buffer<ArrayBuffer>> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'stt-'))
  const inputPath = join(tmpDir, 'input.webm')
  const outputPath = join(tmpDir, 'output.wav')

  try {
    await writeFile(inputPath, inputBuffer)
    await execFileAsync('ffmpeg', [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-sample_fmt', 's16',
      '-f', 'wav',
      '-y',
      outputPath,
    ], { timeout: 30_000 })
    const result = await readFile(outputPath)
    return Buffer.from(result) as Buffer<ArrayBuffer>
  }
  catch {
    throw new SttError('Не удалось обработать аудио', 500)
  }
  finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

export async function transcribeAudio(
  file: Blob,
  filename: string,
): Promise<TranscribeResult> {
  const apiKey = process.env.ROUTERAI_API_KEY
  if (!apiKey) {
    throw new SttError('STT-ключ не настроен на сервере', 503)
  }

  let sendBuffer = Buffer.from(await file.arrayBuffer())
  let sendFilename = filename

  if (file.type.includes('webm')) {
    sendBuffer = await convertWebmToWav(sendBuffer)
    sendFilename = filename.replace(/\.webm$/i, '.wav')
  }

  const form = new FormData()
  form.append('file', new Blob([sendBuffer], { type: 'audio/wav' }), sendFilename)
  form.append('model', STT_MODEL)
  form.append('language', 'ru')

  let res: Response
  try {
    res = await fetch(`${ROUTERAI_BASE}/audio/transcriptions`, {
      body: form,
      headers: { Authorization: `Bearer ${apiKey}` },
      method: 'POST',
    })
  }
  catch {
    throw new SttError('Сервис расшифровки недоступен', 502)
  }

  if (!res.ok) {
    await res.text().catch(() => '')
    throw new SttError(`Ошибка расшифровки (HTTP ${res.status})`, 502)
  }

  const data = (await res.json()) as {
    text?: string
    usage?: { seconds?: number, cost?: number }
  }

  return {
    cost: data.usage?.cost ?? 0,
    durationSec: data.usage?.seconds ?? 0,
    text: (data.text ?? '').trim(),
  }
}
