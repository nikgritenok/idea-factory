// Что карточка идеи на доске может предложить владельцу — чистая функция, без реактивности:
// именно здесь живёт правило «во время прогона кнопки «Запустить анализ» быть не должно».
// Вынесено отдельно, чтобы проверялось тестом, а не скриншотом.

export type CardAction = 'archive' | 'delete' | 'restore' | 'resume' | 'run' | 'stop'
export type CardTone = 'error' | 'paused' | 'running'

export interface JobSnapshot {
  currentStep?: null | string
  id: string
  status: string
}

export interface CardPlan {
  actions: CardAction[]
  plate: null | { icon: string, spinning: boolean, text: string, tone: CardTone }
}

export const ACTION_LABELS: Record<CardAction, string> = {
  archive: 'В архив',
  delete: 'Удалить идею',
  restore: 'Вернуть в воронку',
  resume: 'Продолжить анализ',
  run: 'Запустить анализ',
  stop: 'Остановить',
}

/** Вторичные (не заливаемые) действия карточки — по DESIGN.md «одна primary на экран». */
export const QUIET_ACTIONS: ReadonlySet<CardAction> = new Set<CardAction>([
  'archive',
  'delete',
  'restore',
  'stop',
])

/**
 * Статус прогона ещё не известен (запрос `/latest-job` в полёте). За это время
 * карточка не должна показывать ни «Запустить анализ», ни «Остановить»: иначе
 * на первый кадр она предлагает запустить то, что уже запущено, и действие
 * мигает («Запустить анализ» → «Остановить») на глазах у владельца.
 */
export function planCardActions(funnelStage: string, job: JobSnapshot | null, jobKnown = true): CardPlan {
  // Архив — тупик воронки: запускать нельзя (сервер отвечает IDEA_ARCHIVED),
  // поэтому единственные осмысленные действия — вернуть или удалить.
  if (funnelStage === 'archived') {
    return { actions: ['restore', 'delete'], plate: null }
  }

  if (!jobKnown) {
    return { actions: ['archive'], plate: null }
  }

  const status = job?.status

  if (status === 'queued') {
    // Спиннер здесь врал бы: задача ещё не выполняется, она ждёт обработчика.
    return {
      actions: ['stop', 'archive'],
      plate: { icon: 'lucide:clock', spinning: false, text: 'Идея в очереди', tone: 'running' },
    }
  }

  if (status === 'running') {
    const step = job?.currentStep
    return {
      actions: ['stop', 'archive'],
      plate: {
        icon: 'lucide:loader-2',
        spinning: true,
        text: step ? `Идёт анализ · ${step}` : 'Идёт анализ',
        tone: 'running',
      },
    }
  }

  if (status === 'paused') {
    return { actions: ['resume', 'archive'], plate: { icon: 'lucide:pause', spinning: false, text: 'Пауза', tone: 'paused' } }
  }

  if (status === 'failed') {
    // /run идемпотентен только для queued|running|paused, так что для failed он даёт новый прогон
    return { actions: ['run', 'archive'], plate: { icon: 'lucide:circle-alert', spinning: false, text: 'Прогон упал', tone: 'error' } }
  }

  if (funnelStage === 'mvp_ready') {
    return { actions: ['archive'], plate: null }
  }

  return { actions: ['run', 'archive'], plate: null }
}
