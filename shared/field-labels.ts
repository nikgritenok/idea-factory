/**
 * Русские метаданные для полей и значений, которые приходят из схем агентов
 * и расчётного модуля.
 *
 * Почему это вообще нужно: роли возвращают русские тексты по англоязычным
 * ключам Zod-схем (`willingnessToPay`, `painPoints`), а расчёт отдаёт enum'ы
 * (`validate_first`, `unfavorable`). В материалах фазы и в карточке эффекта
 * «size: ~15%» и «Уверенность: medium» читаются как незавершённая работа.
 *
 * Неизвестный ключ возвращается как есть — молча пропадать поле хуже, чем
 * поле с техническим именем. Расхождение с реальными схемами ловит тест.
 */

/** Ключ схемы → человекочитаемое имя поля. */
export const FIELD_LABELS: Record<string, string> = {
  action: 'Действие',
  aiCorrectRate: 'Доля верных ответов ИИ',
  aiMinutes: 'Минут с ИИ на заявку',
  assumptions: 'Допущения',
  audience: 'Аудитория',
  baseline: 'База',
  blockers: 'Блокеры',
  bootstrap: 'Bootstrap',
  calculation: 'Расчёт',
  change: 'Изменение',
  characteristics: 'Характеристики',
  competitors: 'Конкуренты',
  complexity: 'Сложность',
  confidence: 'Уверенность',
  constraints: 'Ограничения',
  correctRate: 'Доля верных ответов',
  decision: 'Решение',
  description: 'Описание',
  deterministic: 'Детерминированность',
  duration: 'Длительность',
  durationMs: 'Длительность, мс',
  effect: 'Эффект',
  effectPerTicket: 'Эффект на заявку, мин',
  effectPerTicketDelta: 'Прирост эффекта на заявку, мин',
  effectVolumeHours: 'Эффект на объём, ч/мес',
  estimatedMinutes: 'Оценка времени, мин',
  experimentPriority: 'Приоритет эксперимента',
  experiments: 'Эксперименты',
  formula: 'Формула',
  goals: 'Цели',
  hypotheses: 'Гипотезы',
  hypothesis: 'Гипотеза',
  inputSummary: 'Вход расчёта',
  insights: 'Выводы',
  keyFactors: 'Ключевые факторы',
  kind: 'Тип',
  lower: 'Нижняя граница',
  mainVariant: 'Основной вариант',
  marketSize: 'Объём рынка',
  meanDiff: 'Средняя разница',
  meanMinutes: 'Среднее время, мин',
  method: 'Метод',
  metric: 'Метрика',
  mitigation: 'Как снизить',
  missingCount: 'Пропущенных заявок',
  missingRate: 'Доля пропусков',
  modelVersion: 'Версия модели',
  monthlyVolume: 'Заявок в месяц',
  name: 'Название',
  nextSteps: 'Следующие шаги',
  note: 'Заметка',
  notes: 'Заметки',
  objections: 'Возражения',
  overallScore: 'Оценка',
  pDeleterious: 'Доля ресемплов без эффекта',
  painPoints: 'Боли',
  param: 'Параметр',
  params: 'Параметры',
  personas: 'Сегменты и персоны',
  priority: 'Приоритет',
  probability: 'Вероятность',
  problem: 'Проблема',
  quality: 'Качество ИИ',
  reason: 'Причина',
  reasoning: 'Обоснование',
  recommendedScenario: 'Рекомендуемый сценарий',
  recommendation: 'Рекомендация',
  resamples: 'Ресемплирований',
  resources: 'Ресурсы',
  reviewMinutes: 'Минут на проверку человеком',
  reworkMinutes: 'Минут на переделку',
  reworkRate: 'Доля переделок',
  risks: 'Риски',
  role: 'Роль',
  rowCount: 'Строк в выборке',
  rule: 'Правило',
  rules: 'Правила',
  scenarios: 'Сценарии',
  seed: 'Seed',
  segments: 'Сегменты',
  sensitivity: 'Чувствительность',
  severity: 'Критичность',
  simulation: 'Симуляция',
  size: 'Размер',
  solution: 'Решение',
  sourceTranscript: 'Исходный текст идеи',
  step: 'Шаг',
  steps: 'Шаги',
  stopFactor: 'Стоп-фактор',
  stopFactors: 'Стоп-факторы',
  strengths: 'Сильные стороны',
  successMetrics: 'Метрики успеха',
  successThreshold: 'Порог успеха',
  title: 'Заголовок',
  trends: 'Тренды',
  triggered: 'Сработало',
  type: 'Тип',
  unit: 'Единица',
  units: 'Единицы измерения',
  upper: 'Верхняя граница',
  value: 'Ценность',
  variantMinutes: 'Минут в варианте',
  warnings: 'Предупреждения',
  weaknesses: 'Слабые места',
  willingnessToPay: 'Готовность платить',
  workaround: 'Как обойти',
}

/**
 * Технические enum-значения → человеческие. Род падеж намеренно нейтральный
 * («средний уровень», а не «средняя»), потому что одно и то же значение
 * встречается и у «Уверенность», и у «Приоритет», и у «Критичность».
 */
export const VALUE_LABELS: Record<string, string> = {
  base: 'базовый',
  critical: 'критический',
  develop: 'развивать',
  favorable: 'благоприятный',
  high: 'высокий уровень',
  insufficient_data: 'недостаточно данных',
  low: 'низкий уровень',
  medium: 'средний уровень',
  optimistic: 'оптимистичный',
  pessimistic: 'пессимистичный',
  postpone: 'отложить',
  reject: 'отклонить',
  simulation: 'симуляция',
  unfavorable: 'неблагоприятный',
  validate_first: 'сначала провалидировать',
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

/** Перевод только «голых» enum-значений: длинные тексты ответов не трогаем. */
export function fieldValueLabel(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 24 || /\s/.test(trimmed)) {
    return value
  }
  return VALUE_LABELS[trimmed.toLowerCase()] ?? value
}
