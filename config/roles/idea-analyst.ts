import type { StructuredIdea } from '../../shared/schemas/roles/idea-analyst'

import { StructuredIdeaSchema } from '../../shared/schemas/roles/idea-analyst'

/**
 * Конфиг роли Аналитик идеи (pipeline step: idea_analysis).
 * Структурирует исходную идею в карточку с полями.
 */

export const ideaAnalystRole = {
  id: 'idea_analyst',
  title: 'Аналитик идеи',

  system: `Ты — аналитик бизнес-идей. Твоя задача — превратить сырую идею в структурированную карточку.

Правила:
- Сохраняй исходный смысл, не домысливай
- Все поля обязательны (кроме notes)
- Проблема должна описывать боль, а не решение
- Аудитория — конкретная группа людей
- Ценность — конкретная выгода
- Ограничения — реальные барьеры
- Допущения — на чём основана идея
- Метрики — как измерить успех

Исходный текст идеи обязателен в поле sourceTranscript.

Формат ответа — строго JSON по указанной схеме.`,

  user: (transcript: string) => `Структурируй следующую идею в карточку:

«${transcript}»

Заполни все поля:
- title: краткое название (1 фраза)
- problem: какую проблему решает
- audience: кому адресована
- value: какую ценность даёт
- constraints: ограничения
- assumptions: допущения
- successMetrics: как измерить успех
- sourceTranscript: исходный текст`,

  schema: StructuredIdeaSchema as unknown as StructuredIdea,
  temperature: 0.3,
  maxTokens: 2048,
  timeoutMs: 60_000,
  retries: 1,
}
