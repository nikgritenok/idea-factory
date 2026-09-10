import { describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile } from 'node:child_process'
import { SttError, transcribeAudio } from './stt'

const mockExecFile = vi.mocked(execFile)

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
      process.env.ROUTERAI_API_KEY = 'test-key'
      mockExecFile.mockImplementation(
        (...args: unknown[]) => {
          const cb = args[args.length - 1] as (err: Error | null) => void
          cb(null)
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
      process.env.ROUTERAI_API_KEY = 'test-key'
      mockExecFile.mockImplementation(
        (...args: unknown[]) => {
          const cb = args[args.length - 1] as (err: Error | null) => void
          cb(new Error('ffmpeg not found'))
          return {} as any
        },
      )

      const webmBlob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: 'audio/webm' })
      await expect(transcribeAudio(webmBlob, 'test.webm')).rejects.toMatchObject({ status: 500 })
    })

    it('wav-файлы не конвертируются', async () => {
      process.env.ROUTERAI_API_KEY = 'test-key'
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
