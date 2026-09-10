export type { JobSummary } from '../ideas/types'

export const JOB_STATUS_LABELS: Record<string, string> = {
  completed: 'Завершён',
  failed: 'Ошибка',
  paused: 'Пауза',
  queued: 'В очереди',
  running: 'Выполняется',
  waiting_for_data: 'Ожидание данных',
}
