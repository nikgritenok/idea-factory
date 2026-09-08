/**
 * Каталог компонентов (TZ §9).
 * Назначение, API/способ вызова, схема входа/выхода, версия, зависимости, ограничения.
 */

export interface ComponentInfo {
  id: string
  name: string
  description: string
  version: string
  api: {
    type: 'http' | 'sdk' | 'cli'
    endpoint?: string
    method?: string
  }
  input: {
    format: string
    description: string
  }
  output: {
    format: string
    description: string
  }
  dependencies: string[]
  limitations: string[]
  metrics: string[]
}

export const COMPONENTS: Record<string, ComponentInfo> = {
  llm: {
    id: 'llm',
    name: 'LLM (z-ai/glm-5.3-flash)',
    description: 'Языковая модель для классификации, анализа и генерации текста',
    version: 'v1',
    api: {
      type: 'http',
      endpoint: 'https://routerai.ru/api/v1/chat/completions',
      method: 'POST',
    },
    input: {
      format: 'JSON (system + user prompts)',
      description: 'Системный промпт + пользовательский запрос',
    },
    output: {
      format: 'JSON (структура по Zod-схеме роли)',
      description: 'Ответ модели, валидированный через Zod',
    },
    dependencies: ['ROUTERAI_API_KEY'],
    limitations: [
      'Требует стабильного интернета',
      'Ограничения по токенам (4096 по умолчанию)',
      'Стоимость: ~0.01–0.10 ₽ за запрос',
    ],
    metrics: ['tokens', 'latency_ms', 'cost'],
  },

  stt: {
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
  },

  validator: {
    id: 'validator',
    name: 'Валидатор правил',
    description: 'Проверка обязательных полей, допустимых значений, согласованности',
    version: '1.0.0',
    api: {
      type: 'http',
      endpoint: 'http://localhost:3001/validate',
      method: 'POST',
    },
    input: {
      format: 'JSON { category, priority, responsibleDepartment }',
      description: 'Классификация обращения от LLM',
    },
    output: {
      format: 'JSON { valid, errors[] }',
      description: 'Результат валидации + список ошибок',
    },
    dependencies: [],
    limitations: [
      'Изолирован от ключей оркестратора (TZ §11)',
      'Проверяет только бизнес-правила',
    ],
    metrics: ['latency_ms', 'valid_rate'],
  },
}

/** Получить информацию о компоненте */
export function getComponent(id: string): ComponentInfo | undefined {
  return COMPONENTS[id]
}

/** Все компоненты */
export function getAllComponents(): ComponentInfo[] {
  return Object.values(COMPONENTS)
}
