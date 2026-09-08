import type { ComponentInfo } from './index'

/**
 * Конфиг LLM-компонента (z-ai/glm-5.3-flash через routerai.ru).
 */

export const LLM_COMPONENT: ComponentInfo = {
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
}
