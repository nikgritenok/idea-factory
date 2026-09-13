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

Верни СТРОГО JSON ровно в таком формате (без markdown, без пояснений):
{"weaknesses":[{"description":"слабое место","severity":"high","mitigation":"как смягчить"}],"stopFactors":[{"description":"стоп-фактор","reason":"почему","workaround":"обходной путь если есть"}],"overallScore":50,"confidence":"medium","recommendation":"develop","reasoning":"обоснование от 20 символов","nextSteps":["шаг 1"]}
Массив weaknesses — минимум 2 элемента. stopFactors — пустой массив [], если стоп-факторов нет.`,

  schema: CriticReviewSchema,
  temperature: 0.15,
  maxTokens: 8192,
  timeoutMs: 300_000,
  retries: 1,
}
