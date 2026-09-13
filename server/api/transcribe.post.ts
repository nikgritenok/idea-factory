import { createError, useLogger } from 'evlog'
import { z } from 'zod'

import { SttError, transcribeAudio } from '../utils/stt'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const MAX_DURATION_SEC = 600

const TranscribeFormSchema = z.object({
  audio: z.object({
    data: z.instanceof(Buffer).refine(
      buf => buf.length > 0,
      'Нет файла аудио',
    ).refine(
      buf => buf.length <= MAX_AUDIO_BYTES,
      'Аудио больше 25 МБ — запишите короче',
    ),
    filename: z.string().optional(),
    type: z.string().default('audio/webm'),
  }),
  durationSec: z.coerce.number().int().positive().max(
    MAX_DURATION_SEC,
    'Запись длиннее 10 минут — запишите короче',
  ).optional().default(0),
})

// POST /api/transcribe — расшифровка голосовой заметки (TZ §3)
export default defineEventHandler(async (event) => {
  const log = useLogger(event)

  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({
      code: 'AUDIO_MISSING',
      fix: 'Запишите голосовую заметку заново или введите текст вручную',
      message: 'Нет файла аудио',
      status: 400,
      why: 'Тело запроса пришло без multipart-формы — поле audio отсутствует',
    })
  }

  const audioPart = form.find(p => p.name === 'audio')
  const durationPart = form.find(p => p.name === 'durationSec')

  const parsed = TranscribeFormSchema.parse({
    audio: audioPart ?? { data: Buffer.alloc(0), type: 'audio/webm' },
    durationSec: durationPart?.data.toString() ?? '0',
  })

  // Сам аудиобуфер в событие не идёт — только метаданные запроса
  log.set({
    audio: {
      durationSec: parsed.durationSec,
      filename: parsed.audio.filename ?? null,
      mime: parsed.audio.type,
      sizeBytes: parsed.audio.data.length,
    },
  })

  const mime = parsed.audio.type
  let ext = 'webm'
  if (mime.includes('wav')) {
    ext = 'wav'
  }
  else if (mime.includes('mpeg')) {
    ext = 'mp3'
  }
  else if (mime.includes('ogg')) {
    ext = 'ogg'
  }

  try {
    const result = await transcribeAudio(
      new Blob([new Uint8Array(parsed.audio.data)], { type: mime }),
      `recording.${ext}`,
    )

    if (!result.text) {
      log.set({ stt: { result: 'empty' } })
      return {
        code: 'empty_transcript' as const,
        message: 'Речь не распознана. Попробуйте записать ещё раз или введите текст.',
        ok: false as const,
      }
    }

    log.set({ stt: { chars: result.text.length, cost: result.cost, seconds: result.durationSec } })

    return {
      cost: result.cost,
      durationSec: result.durationSec,
      ok: true as const,
      text: result.text,
    }
  }
  catch (e) {
    if (e instanceof SttError) {
      // status у SttError уже различает причины: 503 — ключ, 502 — сервис, 500 — ffmpeg
      let code = 'STT_PROCESSING_FAILED'
      if (e.status === 503) {
        code = 'STT_NOT_CONFIGURED'
      }
      else if (e.status === 502) {
        code = 'STT_UPSTREAM_ERROR'
      }

      throw createError({
        cause: e,
        code,
        data: { ext },
        fix: e.status === 503
          ? 'Серверу нужен ROUTERAI_API_KEY в окружении (см. .env.example)'
          : 'Повторите запись короче или введите текст вручную — расшифровка платная, слепые ретраи не делаем',
        internal: { status: e.status },
        message: e.message,
        status: e.status ?? 502,
        why: 'Сервис расшифровки не вернул текст',
      })
    }
    throw e
  }
})
