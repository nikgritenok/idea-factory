import { z } from 'zod'
import { transcribeAudio, SttError } from '../utils/stt'

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
    type: z.string().default('audio/webm'),
    filename: z.string().optional(),
  }),
  durationSec: z.coerce.number().int().positive().max(
    MAX_DURATION_SEC,
    'Запись длиннее 10 минут — запишите короче',
  ).optional().default(0),
})

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form || !form.length) {
    throw createError({ statusCode: 400, statusMessage: 'Нет файла аудио' })
  }

  const audioPart = form.find(p => p.name === 'audio')
  const durationPart = form.find(p => p.name === 'durationSec')

  const parsed = TranscribeFormSchema.parse({
    audio: audioPart ?? { data: Buffer.alloc(0), type: 'audio/webm' },
    durationSec: durationPart?.data.toString() ?? '0',
  })

  const mime = parsed.audio.type
  const ext = mime.includes('wav')
    ? 'wav'
    : mime.includes('mpeg')
      ? 'mp3'
      : mime.includes('ogg')
        ? 'ogg'
        : 'webm'

  try {
    const result = await transcribeAudio(
      new Blob([new Uint8Array(parsed.audio.data)], { type: mime }),
      `recording.${ext}`,
    )

    if (!result.text) {
      return {
        ok: false as const,
        code: 'empty_transcript' as const,
        message: 'Речь не распознана. Попробуйте записать ещё раз или введите текст.',
      }
    }

    return {
      ok: true as const,
      text: result.text,
      durationSec: result.durationSec,
      cost: result.cost,
    }
  }
  catch (e) {
    if (e instanceof SttError) {
      throw createError({ statusCode: e.status ?? 502, statusMessage: e.message })
    }
    throw e
  }
})
