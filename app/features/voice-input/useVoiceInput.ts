export interface TranscribeResult {
  code?: 'empty_transcript'
  error?: { code: string, message: string }
  text?: string
}

export function useVoiceInput() {
  const recording = ref(false)
  const transcribing = ref(false)
  const audioBlob = ref<Blob | null>(null)
  const durationSec = ref(0)
  const error = ref<null | string>(null)

  let mediaRecorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let stream: MediaStream | null = null
  let startedAt = 0
  let timer: null | ReturnType<typeof setInterval> = null

  async function start(): Promise<void> {
    error.value = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    }
    catch {
      error.value = 'Нет доступа к микрофону. Разрешите доступ в настройках браузера или введите текст.'
      return
    }

    chunks = []
    durationSec.value = 0
    startedAt = Date.now()

    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime })
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    mediaRecorder.start(500)
    recording.value = true

    timer = setInterval(() => {
      durationSec.value = Math.round((Date.now() - startedAt) / 1000)
    }, 500)
  }

  async function stop(): Promise<void> {
    await new Promise((resolve) => {
      if (!mediaRecorder || !recording.value) {
        resolve()
        return
      }
      mediaRecorder.onstop = () => {
        audioBlob.value = new Blob(chunks, { type: 'audio/webm' })
        stream?.getTracks().forEach((t) => {
          t.stop()
        })
        if (timer) clearInterval(timer)
        recording.value = false
        resolve()
      }
      mediaRecorder.stop()
    })
  }

  async function transcribe(): Promise<null | string> {
    if (!audioBlob.value) return null
    transcribing.value = true
    error.value = null
    try {
      const form = new FormData()
      form.append('audio', audioBlob.value, 'recording.webm')
      form.append('durationSec', String(durationSec.value))
      const result = await $fetch<TranscribeResult>('/api/transcribe', { body: form, method: 'POST' })
      if (result.code === 'empty_transcript') {
        error.value = 'Расшифровка пуста — возможно, запись слишком короткая или тихая.'
        return null
      }
      return result.text ?? null
    }
    catch (err) {
      const e = err as { data?: { message?: string, statusMessage?: string }, message?: string }
      error.value = e.data?.message ?? e.data?.statusMessage ?? e.message ?? 'Ошибка расшифровки'
      return null
    }
    finally {
      transcribing.value = false
    }
  }

  function reset(): void {
    audioBlob.value = null
    durationSec.value = 0
    error.value = null
  }

  onUnmounted(() => {
    stream?.getTracks().forEach((t) => {
      t.stop()
    })
    if (timer) clearInterval(timer)
  })

  return { audioBlob, durationSec, error, recording, reset, start, stop, transcribe, transcribing }
}
