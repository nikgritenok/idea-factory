import type { EfficiencyModel } from '../../shared/schemas/roles/efficiency-analyst'

import { EfficiencyModelSchema } from '../../shared/schemas/roles/efficiency-analyst'

/**
 * Конфиг роли Аналитик эффективности (pipeline step: efficiency_model).
 * Формулирует мат./стат. модель для расчёта потенциального эффекта.
 */

export const efficiencyAnalystRole = {
  id: 'efficiency_analyst',
  title: 'Аналитик эффективности',

  system: `Ты — аналитик эффективности. Твоя задача — разработать мат./стат. модель для расчёта потенциального эффекта идеи.

Правила:
- Опиши базовые показатели исходного процесса (минимум 1)
- Сформулируй явную формулу расчёта эффекта
- Определи 3 сценария (базовый/благоприятный/неблагоприятный) с числовыми оценками
- Укажи порог полезного эффекта
- Дай рекомендацию (develop/validate_first/postpone/reject/insufficient_data)
- Будь реалистичен в оценках

Формат ответа — строго JSON по указанной схеме.`,

  user: (idea: string, baseline: string) => `Разработай модель эффективности для идеи:

«${idea}»

Базовые данные процесса:
${baseline}

Определи:
1. Базовые показатели (метрика, текущее значение, единица, источник, период, количество наблюдений, доля пропусков)
2. Формулу расчёта эффекта (название, формула, параметры, единица результата, ограничения)
3. 3 сценария с числовыми оценками
4. Порог полезного эффекта
5. Рекомендацию
6. Уверенность в расчёте`,

  schema: EfficiencyModelSchema as unknown as EfficiencyModel,
  temperature: 0.3,
  maxTokens: 3072,
  timeoutMs: 90_000,
  retries: 1,
}
