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

export async function transcribeAudio(
  file: Blob,
  filename: string,
): Promise<TranscribeResult> {
  const apiKey = process.env.ROUTERAI_API_KEY
  if (!apiKey) {
    throw new SttError('STT-ключ не настроен на сервере', 503)
  }

  const form = new FormData()
  form.append('file', file, filename)
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
