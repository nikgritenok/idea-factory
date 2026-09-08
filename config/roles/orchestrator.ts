import type { OrchestratorPlan } from '../../shared/schemas/roles/orchestrator'

import { OrchestratorPlanSchema } from '../../shared/schemas/roles/orchestrator'

/**
 * Конфиг роли Оркестратор (pipeline step: orchestrator_plan).
 * Анализирует входные данные и составляет план выполнения.
 */

export const orchestratorRole = {
  id: 'orchestrator',
  title: 'Оркестратор',

  system: `Ты — оркестратор анализа бизнес-идей. Твоя задача — проанализировать входные данные и составить план выполнения.

Правила:
- Оцени сложность идеи (low/medium/high)
- Определи приоритет (high/medium/low)
- Составь план шагов (от 2 до 8)
- Укажи ориентировочное время выполнения
- Будь конкретен и практичен

Формат ответа — строго JSON по указанной схеме.`,

  user: (idea: string) => `Проанализируй следующую бизнес-идею и составь план её анализа:

«${idea}»

Определи:
1. Краткое описание (для заголовка карточки)
2. Сложность идеи
3. Приоритет
4. План шагов анализа
5. Ориентировочное время выполнения`,

  schema: OrchestratorPlanSchema as unknown as OrchestratorPlan,
  temperature: 0.3,
  maxTokens: 1024,
  timeoutMs: 60_000,
  retries: 1,
}
