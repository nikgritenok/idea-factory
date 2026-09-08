import type { ComponentInfo } from './index'

/**
 * Конфиг микросервиса-валидатора (services/validator/).
 */

export const VALIDATOR_COMPONENT: ComponentInfo = {
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
}
