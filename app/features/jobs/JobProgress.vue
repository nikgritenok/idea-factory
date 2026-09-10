<script setup lang="ts">
import type { JobSummary } from './types'

import { JOB_STATUS_LABELS } from './types'

const props = defineProps<{
  busy: boolean
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

const PIPELINE_STEPS = [
  { id: 'orchestrator_plan', title: 'Оркестратор: план анализа' },
  { id: 'idea_analysis', title: 'Аналитик идеи: структура карточки' },
  { id: 'market_research', title: 'Аналитик рынка и аудитории' },
  { id: 'strategy', title: 'Стратег-аналитик: сценарии и эксперименты' },
  { id: 'efficiency_model', title: 'Аналитик эффективности: мат./стат. модель' },
  { id: 'critic_review', title: 'Критик: слабые места, стоп-факторы' },
  { id: 'report_build', title: 'Редактор отчёта: сборка версии отчёта' },
] as const

const currentStepIndex = computed(() => {
  const id = props.job?.currentStep
  if (!id) return -1
  return PIPELINE_STEPS.findIndex(s => s.id === id)
})

const isRunning = computed(() =>
  props.job !== null && props.job !== undefined && ['queued', 'running'].includes(props.job.status),
)
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
        aria-label="Шаги пайплайна"
      >
        <li
          v-for="(step, i) in PIPELINE_STEPS"
          :key="step.id"
          class="flex items-start gap-2.5 text-sm"
          :aria-current="i === currentStepIndex ? 'step' : undefined"
        >
          <span
            class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            :class="i < currentStepIndex ? 'bg-success-soft text-success'
              : i === currentStepIndex ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'"
            aria-hidden="true"
          >
            {{ i < currentStepIndex ? '✓' : i + 1 }}
          </span>
          <span :class="i === currentStepIndex ? 'font-medium' : 'text-muted-foreground'">
            {{ step.title }}
          </span>
        </li>
      </ol>
      <p
        v-if="job.error"
        class="rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive"
        role="alert"
      >
        {{ job.error }}
      </p>

      <div
        v-if="!readonly"
        class="flex flex-wrap gap-2 pt-1"
      >
        <button
          v-if="job.status === 'running'"
          type="button"
          :disabled="busy"
          class="inline-flex h-10 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('pause')"
        >
          Пауза
        </button>
        <button
          v-if="job.status === 'paused'"
          type="button"
          :disabled="busy"
          class="inline-flex h-10 items-center rounded-full bg-secondary px-4 text-sm font-medium text-[#111111] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('resume')"
        >
          Продолжить
        </button>
        <button
          v-if="isRunning"
          type="button"
          :disabled="busy"
          class="inline-flex h-10 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('cancel')"
        >
          Отменить
        </button>
        <button
          v-if="['done', 'failed', 'cancelled'].includes(job.status)"
          type="button"
          :disabled="busy"
          class="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="emit('rerun')"
        >
          Запустить заново
        </button>
      </div>
    </template>
  </section>
</template>
