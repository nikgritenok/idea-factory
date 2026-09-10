<script setup lang="ts">
import type { IdeaSummary } from '../ideas/types'

import { extractApiMessage, FUNNEL_LABELS, FUNNEL_STAGES, PRIORITY_LABELS } from '../ideas/types'

const route = useRoute()
const isDemo = computed(() => route.query.demo === '1')

const { error, ideas, pending, refresh } = useIdeas()

const stageFilter = ref<string>('all')
const runningJobs = ref<Record<string, { status: string, currentStep: null | string }>>({})
const actionError = ref<null | string>(null)
const busyIdeaId = ref<null | string>(null)

const filtered = computed(() =>
  stageFilter.value === 'all'
    ? ideas.value
    : ideas.value.filter(i => i.funnelStage === stageFilter.value),
)

const activeCount = computed(() =>
  ideas.value.filter(i => i.funnelStage !== 'archived').length,
)

const LIMIT = 10

function stageClasses(stage: string): string {
  if (stage === 'mvp_ready') return 'bg-success-soft text-success'
  if (stage === 'decision') return 'bg-accent/20 text-[#7a5200]'
  if (stage === 'draft') return 'bg-muted text-muted-foreground'
  return 'bg-primary-soft text-primary'
}

function priorityClasses(priority: string): string {
  if (priority === 'high') return 'bg-secondary-soft text-foreground'
  if (priority === 'low') return 'bg-muted text-muted-foreground'
  return 'bg-surface-cream text-foreground'
}

async function loadJobStatus(ideaId: string): Promise<void> {
  try {
    const data = await $fetch<{ job: { status: string, currentStep: null | string } | null }>(
      `/api/ideas/${ideaId}/latest-job`,
    )
    if (data.job && ['queued', 'running', 'paused', 'failed'].includes(data.job.status)) {
      runningJobs.value = { ...runningJobs.value, [ideaId]: data.job }
    }
  }
  catch {
    // нет активной задачи или сбой статуса — индикатор на доске просто не показывается
  }
}

async function runAnalysis(idea: IdeaSummary): Promise<void> {
  busyIdeaId.value = idea.id
  actionError.value = null
  try {
    await $fetch(`/api/ideas/${idea.id}/run`, { method: 'POST' })
    await loadJobStatus(idea.id)
    await refresh()
  }
  catch (err: unknown) {
    actionError.value = extractApiMessage(err)
  }
  finally {
    busyIdeaId.value = null
  }
}

async function archive(idea: IdeaSummary): Promise<void> {
  busyIdeaId.value = idea.id
  actionError.value = null
  try {
    await $fetch(`/api/ideas/${idea.id}`, { body: { funnel_stage: 'archived' }, method: 'PATCH' })
    await refresh()
  }
  catch (err: unknown) {
    actionError.value = extractApiMessage(err)
  }
  finally {
    busyIdeaId.value = null
  }
}

onMounted(() => {
  for (const idea of ideas.value) void loadJobStatus(idea.id)
})

const emptyText = computed(() =>
  stageFilter.value === 'all'
    ? 'Идей пока нет. Создайте первую — опишите её текстом или продиктуйте.'
    : 'В этом этапе воронки идей нет.',
)
</script>

<template>
  <div class="space-y-8">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
          Воронка идей
        </h1>
        <p class="text-sm text-muted-foreground">
          Активных идей: {{ activeCount }} из {{ LIMIT }}
        </p>
      </div>
      <NuxtLink
        to="/ideas/new"
        class="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        + Новая идея
      </NuxtLink>
    </header>

    <div
      v-if="activeCount >= LIMIT"
      class="rounded-xl bg-accent/20 p-4 text-sm"
      role="status"
    >
      Достигнут лимит {{ LIMIT }} активных идей — новые можно добавлять после архивирования.
    </div>

    <div
      class="flex flex-wrap gap-1.5"
      role="group"
      aria-label="Фильтр по этапу воронки"
    >
      <button
        type="button"
        class="rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="stageFilter === 'all' ? 'bg-foreground text-background' : 'bg-surface text-foreground'"
        @click="stageFilter = 'all'"
      >
        Все ({{ ideas.length }})
      </button>
      <button
        v-for="stage in FUNNEL_STAGES"
        :key="stage"
        type="button"
        class="rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="stageFilter === stage ? 'bg-foreground text-background' : 'bg-surface text-foreground'"
        @click="stageFilter = stage"
      >
        {{ FUNNEL_LABELS[stage] }} ({{ ideas.filter(i => i.funnelStage === stage).length }})
      </button>
    </div>

    <p
      v-if="actionError"
      class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      {{ actionError }}
    </p>

    <div
      v-if="pending"
      class="space-y-3"
      role="status"
      aria-label="Загрузка идей"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="h-24 animate-pulse rounded-2xl bg-surface"
      />
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border bg-card p-6 text-center"
      role="alert"
    >
      <p class="text-sm text-destructive">
        Не удалось загрузить идеи: {{ extractApiMessage(error) }}
      </p>
      <button
        type="button"
        class="mt-3 text-sm font-medium text-primary underline"
        @click="refresh()"
      >
        Повторить
      </button>
    </div>

    <p
      v-else-if="filtered.length === 0"
      class="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground"
    >
      {{ emptyText }}
    </p>

    <ul
      v-else
      class="space-y-3"
      aria-label="Список идей"
    >
      <li
        v-for="idea in filtered"
        :key="idea.id"
        class="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-sm"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1 space-y-2">
            <NuxtLink
              :to="`/ideas/${idea.id}`"
              class="text-lg font-bold leading-snug text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {{ idea.title }}
            </NuxtLink>
            <p
              v-if="idea.problem"
              class="line-clamp-2 text-sm leading-6 text-muted-foreground"
            >
              {{ idea.problem }}
            </p>
            <div class="flex flex-wrap items-center gap-1.5">
              <span
                class="rounded-full px-2.5 py-0.5 text-[13px] font-medium"
                :class="stageClasses(idea.funnelStage)"
              >
                {{ FUNNEL_LABELS[idea.funnelStage] ?? idea.funnelStage }}
              </span>
              <span
                class="rounded-full px-2.5 py-0.5 text-[13px] font-medium"
                :class="priorityClasses(idea.priority)"
              >
                {{ PRIORITY_LABELS[idea.priority] ?? idea.priority }}
              </span>
              <span
                v-if="idea.executionStatus === 'running'"
                class="rounded-full bg-primary-soft px-2.5 py-0.5 text-[13px] font-medium text-primary"
              >
                ⏳ {{ runningJobs[idea.id]?.currentStep ? 'шаг: ' + runningJobs[idea.id]?.currentStep : 'выполняется' }}
              </span>
              <span
                v-else-if="idea.executionStatus === 'error'"
                class="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[13px] font-medium text-destructive"
              >
                Ошибка выполнения
              </span>
              <span class="text-xs text-muted-foreground">v{{ idea.version }}</span>
            </div>
          </div>
          <div
            v-if="!isDemo"
            class="flex shrink-0 flex-wrap gap-2"
          >
            <button
              v-if="idea.funnelStage !== 'mvp_ready'"
              type="button"
              :disabled="busyIdeaId === idea.id"
              class="inline-flex h-10 items-center rounded-full bg-secondary px-4 text-sm font-medium text-[#111111] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              @click="runAnalysis(idea)"
            >
              {{ busyIdeaId === idea.id ? 'Запуск…' : 'Запустить анализ' }}
            </button>
            <button
              type="button"
              :disabled="busyIdeaId === idea.id"
              class="inline-flex h-10 items-center rounded-full border bg-background px-4 text-sm font-medium transition-colors hover:bg-surface disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              @click="archive(idea)"
            >
              В архив
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
