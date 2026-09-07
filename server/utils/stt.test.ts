import { describe, it, expect } from 'vitest'
import { transcribeAudio, SttError } from './stt'

describe('transcribeAudio — контракт routerai STT', () => {
  it('без ключа throws SttError 503 (не падает молча)', async () => {
    const saved = process.env.ROUTERAI_API_KEY
    delete process.env.ROUTERAI_API_KEY
    try {
      await expect(
        transcribeAudio(new Blob(['x'], { type: 'audio/wav' }), 't.wav'),
      ).rejects.toMatchObject({ status: 503 })
    }
    finally {
      if (saved) process.env.ROUTERAI_API_KEY = saved
    }
  })

  it('битый аудиофайл — ошибка сервиса, а не тишина', async () => {
    if (!process.env.ROUTERAI_API_KEY) {
      console.log('SKIP: ROUTERAI_API_KEY не задан (офлайн-прогон)')
      return
    }
    const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/wav' })
    await expect(transcribeAudio(blob, 'broken.wav')).rejects.toBeInstanceOf(SttError)
  })
})
