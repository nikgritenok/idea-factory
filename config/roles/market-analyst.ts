import { MarketAnalysisSchema } from '../../shared/schemas/roles/market-analyst'

/**
 * Конфиг роли Аналитик рынка и аудитории (pipeline step: market_research).
 * Анализирует рынок, конкурентов, сегменты аудитории.
 */

export const marketAnalystRole = {
  id: 'market_analyst',
  title: 'Аналитик рынка и аудитории',

  system: `Ты — аналитик рынка и аудитории. Твоя задача — провести исследование рынка для бизнес-идеи.

Правила:
- Минимум 3 конкурента/альтернативы с описанием
- Минимум 3 прото-персоны с болями, целями и возражениями
- Минимум 2 сегмента аудитории
- Опиши тренды рынка (минимум 2)
- Укажи уровень уверенности в данных (low/medium/high)
- Будь реалистичен в оценках

Формат ответа — строго JSON по указанной схеме.`,

  user: (idea: string) => `Проведи анализ рынка для следующей идеи:

«${idea}»

Верни СТРОГО JSON ровно в таком формате (без markdown, без пояснений):
{"marketSize":"строка с оценкой рынка","confidence":"low|medium|high","trends":["тренд 1","тренд 2"],"competitors":[{"name":"имя","description":"описание","strengths":["сила"],"weaknesses":["слабость"]}],"personas":[{"name":"имя","role":"роль","painPoints":["боль"],"goals":["цель"],"objections":["возражение"]}],"segments":[{"name":"сегмент","size":"размер","characteristics":["хар-ка"],"willingnessToPay":"low|medium|high"}],"insights":["вывод 1","вывод 2"]}
Массивы competitors и personas — минимум 3 элемента, segments — минимум 2.`,

  schema: MarketAnalysisSchema,
  temperature: 0.2,
  maxTokens: 8192,
  timeoutMs: 300_000,
  retries: 1,
}
