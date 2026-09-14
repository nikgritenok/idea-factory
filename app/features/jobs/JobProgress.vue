<script setup lang="ts">
/**
 * «Ход работы» — что машина делает с идеей прямо сейчас и что уже сделала.
 *
 * Два правила, которые здесь важнее вёрстки:
 *  1) фазы называются по-человечески (shared/phase-names), а не техническим
 *     заголовком шага: владельцу бессмысленно читать «Оркестратор: план анализа»;
 *  2) кнопка «Материалы» появляется у фазы, выход которой реально сохранён,
 *     а не у той, которая по индекду «прошла» — иначе ссылка ведёт в 404.
 */
import type { JobSummary } from './types'

import type { PhaseRole } from '~~/shared/phase-names'
import { phaseLabel, phaseTitle, PIPELINE_PHASES } from '~~/shared/phase-names'
import MaterialViewer from '../ideas/MaterialViewer.vue'
import { useIdeaOutputs } from '../ideas/useIdeaOutputs'

import { JOB_STATUS_LABELS } from './types'

const props = defineProps<{
  busy: boolean
  ideaId: string
  job: JobSummary | null
  readonly?: boolean
}>()

const emit = defineEmits<{
  cancel: []
  pause: []
  rerun: []
  resume: []
  run: []
}>()

const { hasMaterials, load } = useIdeaOutputs(() => props.ideaId)

// Сырой текст ошибки (с техническими id и HTTP-ответом провайдера) — под режимом
// разработчика; владельцу показываем вывод, а не лог.
const { enabled: devMode, sync: syncDevMode } = useDevMode()

/** Фаза, на которой всё упало: вытаскиваем id из текста ошибки воркера. */
const failedPhaseTitle = computed(() => {
  const match = /Шаг «([a-z_]+)»/.exec(props.job?.error ?? '')
  const title = phaseTitle(match?.[1], '')
  return title
})

const errorText = computed(() => {
  const raw = props.job?.error
  if (!raw) {
    return ''
  }
  const where = failedPhaseTitle.value ? ` на фазе «${failedPhaseTitle.value}»` : ''
  if (/HTTP 4\d\d/.test(raw)) {
    return `Прогон остановился${where}: провайдер моделей отверг запрос (ошибка доступа). Проверьте ключ и баланс — затем запустите прогон заново.`
  }
  if (/timeout|abort|таймаут/i.test(raw)) {
    return `Прогон остановился${where}: фаза не уложилась в отведённое время. Попробуйте запустить заново.`
  }
  return `Прогон остановился${where}. Можно запустить заново — отработанные фазы сохранены.`
})

const currentStepIndex = computed(() => {
  const id = props.job?.currentStep
  if (!id) {
    return -1
  }
  return PIPELINE_PHASES.findIndex(s => s.id === id)
})

const isRunning = computed(() =>
  props.job !== null && props.job !== undefined && ['queued', 'running'].includes(props.job.status),
)

function isCurrent(i: number): boolean {
  return i === currentStepIndex.value && props.job?.status === 'running'
}

function phaseState(i: number, role: PhaseRole): 'done' | 'planned' | 'running' {
  if (isCurrent(i)) {
    return 'running'
  }
  if (hasMaterials(role)) {
    return 'done'
  }
  // Индекс меньше текущего — фаза уже прошла (например, прогон упал на следующей,
  // а материалы старой версии данных не сохранили). Показывать её «впереди» врём.
  return i < currentStepIndex.value ? 'done' : 'planned'
}

onMounted(() => {
  syncDevMode()
  void load()
})

// Прогон идёт → материалы прибывают без перезагрузки страницы: карточка должна
// это подхватить, а не заставлять владельца нажимать F5.
watch(() => props.job?.status, () => {
  void load()
})
</script>

<template>
  <section
    class="space-y-4 rounded-2xl border bg-card p-6"
    aria-labelledby="work-heading"
  >
    <h2
      id="work-heading"
      class="text-lg font-bold"
    >
      Ход работы
    </h2>

    <p
      v-if="!job"
      class="text-sm text-muted-foreground"
    >
      Анализ ещё не запускался.
      <button
        v-if="!readonly"
        type="button"
        class="font-medium text-primary underline"
        @click="emit('run')"
      >
        Запустить
      </button>
    </p>

    <template v-else>
      <p class="text-sm">
        <span class="font-medium">Статус:</span>
        {{ JOB_STATUS_LABELS[job.status] ?? job.status }}
        <span
          v-if="isRunning"
          class="ml-1 inline-block size-2 animate-pulse rounded-full bg-primary align-middle"
          aria-hidden="true"
        />
      </p>
      <ol
        class="space-y-2"
        aria-label="Этапы работы над идеей"
      >
        <li
          v-for="(phase, i) in PIPELINE_PHASES"
          :key="phase.id"
          class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm"
          :aria-current="isCurrent(i) ? 'step' : undefined"
        >
          <span class="flex min-w-0 flex-1 items-start gap-2.5">
            <span
              class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
              :class="phaseState(i, phase.role) === 'done' ? 'bg-success-soft text-success'
                : phaseState(i, phase.role) === 'running' ? 'bg-primary text-primary-foreground step-active'
                  : 'bg-muted text-muted-foreground'"
              :aria-label="phaseState(i, phase.role) === 'done' ? 'Выполнено'
                : phaseState(i, phase.role) === 'running' ? 'Выполняется' : 'В очереди'"
            >
              {{ phaseState(i, phase.role) === 'done' ? '✓' : phaseState(i, phase.role) === 'running' ? '•' : i + 1 }}
            </span>
            <span :class="phaseState(i, phase.role) === 'planned' ? 'text-muted-foreground' : 'font-medium'">
              {{ phaseLabel(phase.id, phaseState(i, phase.role)) }}
            </span>
          </span>
          <MaterialViewer
            v-if="phaseState(i, phase.role) === 'done' && hasMaterials(phase.role)"
            :idea-id="ideaId"
            :role="phase.role"
          />
        </li>
      </ol>
      <p
        v-if="job.error"
        class="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive"
        role="alert"
      >
        {{ errorText }}
      </p>
      <pre
        v-if="job.error && devMode"
        class="overflow-x-auto rounded-lg bg-surface p-2.5 font-mono text-[11px] leading-4 text-muted-foreground"
      >{{ job.error }}</pre>

      <div
        v-if="!readonly"
        class="flex flex-wrap gap-2 pt-1"
      >
        <button
          v-if="job.status === 'running'"
          type="button"
          :disabled="busy"
          class="inline-flex h-11 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('pause')"
        >
          Пауза
        </button>
        <button
          v-if="job.status === 'paused'"
          type="button"
          :disabled="busy"
          class="inline-flex h-11 items-center rounded-full bg-secondary px-4 text-sm font-medium text-[#111111] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('resume')"
        >
          Продолжить
        </button>
        <button
          v-if="isRunning"
          type="button"
          :disabled="busy"
          class="inline-flex h-11 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('cancel')"
        >
          Отменить
        </button>
        <button
          v-if="['done', 'failed', 'cancelled'].includes(job.status)"
          type="button"
          :disabled="busy"
          class="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('rerun')"
        >
          Запустить заново
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
@keyframes step-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(22, 80, 200, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(22, 80, 200, 0); }
}
.step-active {
  animation: step-pulse 2s ease-in-out infinite;
}
</style>
