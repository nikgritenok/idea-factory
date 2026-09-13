import { StrategySchema } from '../../shared/schemas/roles/strategist'

/**
 * Конфиг роли Стратег-аналитик (pipeline step: strategy).
 * Формулирует стратегические сценарии и приоритет эксперимента.
 */

export const strategistRole = {
  id: 'strategist',
  title: 'Стратег-аналитик',

  system: `Ты — стратег-аналитик. Твоя задача — разработать стратегию развития бизнес-идеи.

Правила:
- Минимум 2 сценария развития (базовый + ещё один)
- Каждый сценарий: название, описание, тип (optimistic/base/pessimistic), вероятность, эффект, ключевые факторы
- Минимум 3 проверяемых гипотезы с методом, метрикой, порогом успеха, временем и ресурсами
- Рекомендуй один сценарий как основной
- Формулируй конкретные рекомендации
- Учитывай риски

Формат ответа — строго JSON по указанной схеме.`,

  user: (idea: string, market: string) => `Разработай стратегию для идеи:

«${idea}»

Данные рынка:
${market}

Верни JSON строго в таком формате (без markdown, без пояснений):
{"scenarios":[{"name":"название","description":"описание","effect":"описание эффекта","probability":0.5,"type":"optimistic","keyFactors":["фактор 1"]}],"recommendedScenario":"имя сценария","experiments":[{"hypothesis":"гипотеза","method":"как проверить","metric":"метрика","successThreshold":"порог успеха","duration":"срок","resources":"ресурсы"}],"experimentPriority":1,"recommendations":["рекомендация 1","рекомендация 2"],"risks":["риск 1"]}
Массив scenarios — минимум 2 элемента, experiments — минимум 3.`,

  schema: StrategySchema,
  temperature: 0.2,
  maxTokens: 8192,
  timeoutMs: 300_000,
  retries: 1,
}
