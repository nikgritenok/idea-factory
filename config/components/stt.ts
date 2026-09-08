import type { ComponentInfo } from './index'

/**
 * Конфиг STT-компонента (microsoft/mai-transcribe-2 через routerai.ru).
 */

export const STT_COMPONENT: ComponentInfo = {
  id: 'stt',
  name: 'STT (microsoft/mai-transcribe-2)',
  description: 'Расшифровка голосовых обращений в текст',
  version: 'v1',
  api: {
    type: 'http',
    endpoint: 'https://routerai.ru/api/v1/audio/transcriptions',
    method: 'POST',
  },
  input: {
    format: 'multipart/form-data (audio file)',
    description: 'Аудиофайл (WAV, MP3, OGG) до 25 МБ / 10 мин',
  },
  output: {
    format: 'JSON { text, usage }',
    description: 'Расшифрованный текст + стоимость',
  },
  dependencies: ['ROUTERAI_API_KEY'],
  limitations: [
    'Максимум 25 МБ / 10 минут',
    'Поддержка русского языка',
    'Стоимость: ~0.0031 ₽/сек аудио',
  ],
  metrics: ['duration_sec', 'cost', 'accuracy'],
}
