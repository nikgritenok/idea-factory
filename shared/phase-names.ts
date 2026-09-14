/**
 * Человеческие названия фаз прогона — единственный источник для клиента И сервера.
 *
 * Технические id (`orchestrator_plan`) и роли (`idea_analyst`) остаются в БД и API,
 * меняется только вывод. Раньше UI показывал `Идёт анализ · market_research` и
 * «Оркестратор: план анализа»: владелец не понимал, что делает машина, и не мог
 * понять, чего ждать.
 *
 * Модуль в `shared/`, а не в `app/lib`: сервер (сборка материалов, заголовок .md)
 * обязан называть фазы ровно так же, как карточка, — а `server/**` не имеет права
 * импортировать `app/**` (eslint, правило архитектуры).
 */

export type PhaseRole
  = | 'critic'
    | 'efficiency_analyst'
    | 'idea_analyst'
    | 'market_analyst'
    | 'orchestrator'
    | 'report_editor'
    | 'strategist'

export interface PhaseCopy {
  /** Что фаза уже сделала — для завершённой строки журнала */
  done: string
  /** Что происходит прямо сейчас — для идущей фазы */
  running: string
  /** Короткое имя: бейдж карточки, заголовок материалов, список фаз */
  title: string
}

export const PHASES: Record<PhaseRole, PhaseCopy> = {
  critic: {
    done: 'Нашёл слабые места и стоп-факторы',
    running: 'Проверяю идею на слабые места',
    title: 'Проверка на слабые места',
  },
  efficiency_analyst: {
    done: 'Посчитал эффект в цифрах',
    running: 'Считаю потенциальный эффект в цифрах',
    title: 'Расчёт эффекта',
  },
  idea_analyst: {
    done: 'Разобрал идею: суть, аудитория, ценность',
    running: 'Разбираю вашу идею: суть, аудиторию, ценность',
    title: 'Разбор идеи',
  },
  market_analyst: {
    done: 'Изучил рынок и конкурентов',
    running: 'Изучаю рынок и конкурентов',
    title: 'Рынок и конкуренты',
  },
  orchestrator: {
    done: 'Спланировал, с чего начать',
    running: 'Планирую работу над вашей идеей',
    title: 'План работы',
  },
  report_editor: {
    done: 'Собрал итоговый отчёт',
    running: 'Собираю итоговый отчёт',
    title: 'Сборка отчёта',
  },
  strategist: {
    done: 'Придумал варианты развития',
    running: 'Придумываю варианты развития',
    title: 'Варианты развития',
  },
}

/** id шага из config/pipeline.ts → роль. Шаг и роль — не одно и то же по смыслу. */
const STEP_TO_ROLE: Record<string, PhaseRole> = {
  critic_review: 'critic',
  efficiency_model: 'efficiency_analyst',
  idea_analysis: 'idea_analyst',
  market_research: 'market_analyst',
  orchestrator_plan: 'orchestrator',
  report_build: 'report_editor',
  strategy: 'strategist',
}

/**
 * Порядок фаз для списка «Ход работы». Держится здесь, а не читается из
 * `config/pipeline.ts`: тот тянет за собой zod и серверные схемы, которым в
 * бандле браузера не место. Расхождение с настоящим pipeline ловит тест
 * (сравнивает id, порядок и роли с PIPELINE_STEPS) — дублирование не разъедется.
 */
export const PIPELINE_PHASES: readonly { id: string, role: PhaseRole }[] = [
  { id: 'orchestrator_plan', role: 'orchestrator' },
  { id: 'idea_analysis', role: 'idea_analyst' },
  { id: 'market_research', role: 'market_analyst' },
  { id: 'strategy', role: 'strategist' },
  { id: 'efficiency_model', role: 'efficiency_analyst' },
  { id: 'critic_review', role: 'critic' },
  { id: 'report_build', role: 'report_editor' },
]

export function isPhaseRole(ref: string): ref is PhaseRole {
  return ref in PHASES
}

/** Копия фазы по строке из БД/API; `undefined`, если роль не из пайплайна. */
export function phaseCopy(role: string): PhaseCopy | undefined {
  return isPhaseRole(role) ? PHASES[role] : undefined
}

/** Роль по id шага или по самой роли (UI получает и то, и другое из разных мест). */
export function phaseRole(ref: null | string | undefined): PhaseRole | null {
  if (!ref) {
    return null
  }
  const mapped = STEP_TO_ROLE[ref]
  if (mapped) {
    return mapped
  }
  return isPhaseRole(ref) ? ref : null
}

function phaseOf(ref: null | string | undefined): PhaseCopy | null {
  const role = phaseRole(ref)
  return role ? PHASES[role] : null
}

/**
 * Подпись фазы для UI. `state`:
 * - `running` — идёт сейчас;
 * - `done` — завершена;
 * - `planned` (или пусто) — короткое имя, когда фаза ещё впереди.
 * Неизвестная фаза отдаёт `fallback`: техника не должна показываться владельцу,
 * но и молча исчезать из списка она не вправе.
 */
export function phaseLabel(
  ref: null | string | undefined,
  state: 'done' | 'planned' | 'running' = 'planned',
  fallback = 'Работаем над идеей',
): string {
  const phase = phaseOf(ref)
  if (!phase) {
    return fallback
  }
  if (state === 'running') {
    return phase.running
  }
  if (state === 'done') {
    return phase.done
  }
  return phase.title
}

/** Короткое имя фазы — бейдж карточки, заголовок материала. */
export function phaseTitle(ref: null | string | undefined, fallback = 'Этап'): string {
  return phaseOf(ref)?.title ?? fallback
}
