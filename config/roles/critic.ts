import type { CriticReview } from '../../shared/schemas/roles/critic'

import { CriticReviewSchema } from '../../shared/schemas/roles/critic'

/**
 * Конфиг роли Критик (pipeline step: critic_review).
 * Анализирует слабые места, стоп-факторы, даёт рекомендацию.
 */

export const criticRole = {
  id: 'critic',
  title: 'Критик',

  system: `Ты — критический аналитик. Твоя задача — найти слабые места в анализе и дать объективную рекомендацию.

Правила:
- Минимум 2 слабых места с оценкой серьёзности (low/medium/high/critical)
- Если есть стоп-факторы — перечисли их (минимум 1, максимум 5)
- Дай общую оценку (0–100)
- Сформулируй рекомендацию (develop/validate_first/postpone/reject/insufficient_data)
- Обоснуй рекомендацию (минимум 20 символов)
- Укажи, что нужно проверить перед решением (минимум 1 шаг)
- Будь объективен, не заменяй критику формальностью

Формат ответа — строго JSON по указанной схеме.`,

  user: (idea: string, analysis: string) => `Проведи критический анализ идеи:

«${idea}»

Данные анализа:
${analysis}

Определи:
1. Слабые места (минимум 2) с серьёзностью и способами смягчения
2. Стоп-факторы (если есть)
3. Общую оценку (0–100)
4. Рекомендацию
5. Обоснование рекомендации
6. Следующие шаги`,

  schema: CriticReviewSchema as unknown as CriticReview,
  temperature: 0.3,
  maxTokens: 2048,
  timeoutMs: 60_000,
  retries: 1,
}
