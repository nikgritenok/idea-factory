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

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Нет файла аудио' })
  }

  const audioPart = form.find(p => p.name === 'audio')
  const durationPart = form.find(p => p.name === 'durationSec')

  const parsed = TranscribeFormSchema.parse({
    audio: audioPart ?? { data: Buffer.alloc(0), type: 'audio/webm' },
    durationSec: durationPart?.data.toString() ?? '0',
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
      return {
        code: 'empty_transcript' as const,
        message: 'Речь не распознана. Попробуйте записать ещё раз или введите текст.',
        ok: false as const,
      }
    }

    return {
      cost: result.cost,
      durationSec: result.durationSec,
      ok: true as const,
      text: result.text,
    }
  }
  catch (e) {
    if (e instanceof SttError) {
      throw createError({ statusCode: e.status ?? 502, statusMessage: e.message })
    }
    throw e
  }
})
