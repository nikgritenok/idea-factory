import { execFile } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'

import { SttError, transcribeAudio } from './stt'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

const mockExecFile = vi.mocked(execFile)

// Заглушка для тестов, которым нужен просто «какой-то» ключ: проверка в transcribeAudio
// смотрит на факт наличия, а сетевой вызов ниже всё равно не выполняется (mock/ошибка).
// Значение вынесено в константу: no-secrets ловит литералы, присвоенные в *_API_KEY.
const STT_KEY_PLACEHOLDER = 'not-a-real-key-for-mocks'

describe('transcribeAudio — контракт routerai STT', () => {
  const SAVED_KEY = process.env.ROUTERAI_API_KEY

  it('без ключа throws SttError 503', async () => {
    delete process.env.ROUTERAI_API_KEY
    try {
      await expect(
        transcribeAudio(new Blob(['x'], { type: 'audio/wav' }), 't.wav'),
      ).rejects.toMatchObject({ status: 503 })
    }
    finally {
      if (SAVED_KEY) process.env.ROUTERAI_API_KEY = SAVED_KEY
    }
  })

  it('битый аудиофайл — ошибка сервиса', async () => {
    if (!process.env.ROUTERAI_API_KEY) {
      console.log('SKIP: ROUTERAI_API_KEY не задан')
      return
    }
    const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/wav' })
    await expect(transcribeAudio(blob, 'broken.wav')).rejects.toBeInstanceOf(SttError)
  })

  describe('webm → wav конвертация', () => {
    it('вызывает ffmpeg с нужными аргументами', async () => {
      // Ключ нужен, чтобы пройти проверку в transcribeAudio и дойти до ffmpeg;
      // сам сетевой вызов всё равно падает и перехвачен тестом.
      process.env.ROUTERAI_API_KEY ??= STT_KEY_PLACEHOLDER
      mockExecFile.mockImplementation(
        (...args: unknown[]) => {
          const cb = args.at(-1) as (err: Error | null) => void
          cb(null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- мок execFile: реальный ChildProcess тесту не нужен, важен только вызов колбэка
          return {} as any
        },
      )

      const webmBlob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'audio/webm' })

      try {
        await transcribeAudio(webmBlob, 'test.webm')
      }
      catch {
        // fetch упадёт с test-key — это ожидаемо
      }

      expect(mockExecFile).toHaveBeenCalledOnce()
      const ffmpegArgs = mockExecFile.mock.calls[0]![1] as string[]
      expect(ffmpegArgs).toContain('-ar')
      expect(ffmpegArgs).toContain('16000')
      expect(ffmpegArgs).toContain('-ac')
      expect(ffmpegArgs).toContain('1')
      expect(ffmpegArgs).toContain('-sample_fmt')
      expect(ffmpegArgs).toContain('s16')
    })

    it('tmpdir удаляется при ошибке ffmpeg', async () => {
      // Ключ нужен, чтобы пройти проверку в transcribeAudio и дойти до ffmpeg;
      // сам сетевой вызов всё равно падает и перехвачен тестом.
      process.env.ROUTERAI_API_KEY ??= STT_KEY_PLACEHOLDER
      mockExecFile.mockImplementation(
        (...args: unknown[]) => {
          const cb = args.at(-1) as (err: Error | null) => void
          cb(new Error('ffmpeg not found'))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- мок execFile: реальный ChildProcess тесту не нужен, важен только вызов колбэка
          return {} as any
        },
      )

      const webmBlob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'audio/webm' })
      await expect(transcribeAudio(webmBlob, 'test.webm')).rejects.toMatchObject({ status: 500 })
    })

    it('wav-файлы не конвертируются', async () => {
      // Ключ нужен, чтобы пройти проверку в transcribeAudio и дойти до ffmpeg;
      // сам сетевой вызов всё равно падает и перехвачен тестом.
      process.env.ROUTERAI_API_KEY ??= STT_KEY_PLACEHOLDER
      mockExecFile.mockClear()

      const wavBlob = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: 'audio/wav' })

      try {
        await transcribeAudio(wavBlob, 'test.wav')
      }
      catch {
        // fetch упадёт с test-key — это ожидаемо
      }

      expect(mockExecFile).not.toHaveBeenCalled()
    })
  })
})
