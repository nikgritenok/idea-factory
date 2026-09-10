<script setup lang="ts">
import type { JobSummary } from '../jobs/JobProgress.vue'

import { extractApiMessage } from './types'

const route = useRoute()
const ideaId = route.params.id as string

const idea = ref<Awaited<ReturnType<typeof fetchIdea>>>(null)
const job = ref<JobSummary | null>(null)
const loading = ref(true)
const loadError = ref<null | string>(null)
const actionError = ref<null | string>(null)
const busy = ref(false)

async function load(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    idea.value = await fetchIdea(ideaId)
    if (!idea.value) {
      loadError.value = 'Идея не найдена'
      return
    }
    job.value = await fetchLatestJob(ideaId)
  }
  catch (err: unknown) {
    loadError.value = extractApiMessage(err)
  }
  finally {
    loading.value = false
  }
}

function applyJob(next: JobSummary): void {
  job.value = next
}

async function jobAction(action: 'cancel' | 'pause' | 'resume'): Promise<void> {
  if (!job.value) return
  busy.value = true
  actionError.value = null
  try {
    const data = await $fetch<{ job: JobSummary }>(`/api/jobs/${job.value.id}/${action}`, { method: 'POST' })
    applyJob(data.job)
  }
  catch (err: unknown) {
    actionError.value = extractApiMessage(err)
  }
  finally {
    busy.value = false
  }
}

async function runAnalysis(): Promise<void> {
  busy.value = true
  actionError.value = null
  try {
    const data = await $fetch<{ job: JobSummary }>(`/api/ideas/${ideaId}/run`, { method: 'POST' })
    applyJob(data.job)
  }
  catch (err: unknown) {
    actionError.value = extractApiMessage(err)
  }
  finally {
    busy.value = false
  }
}

const pollTimer = ref<null | ReturnType<typeof setInterval>>(null)

onMounted(async () => {
  await load()
  pollTimer.value = setInterval(async () => {
    if (job.value && ['queued', 'running'].includes(job.value.status)) {
      try {
        const data = await $fetch<{ job: JobSummary }>(`/api/jobs/${job.value.id}`)
        applyJob({ ...data.job } as JobSummary)
      }
      catch {
        // опрос статуса не критичен: следующий тик повторит попытку
      }
    }
  }, 3000)
})

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value)
})
</script>

<template>
  <div class="space-y-8">
    <p
      v-if="loadError"
      class="rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
      role="alert"
    >
      {{ loadError }}
      <NuxtLink
        to="/"
        class="ml-2 underline"
      >Вернуться к воронке</NuxtLink>
    </p>

    <template v-else-if="loading">
      <div
        class="h-10 w-2/3 animate-pulse rounded bg-surface"
        role="status"
        aria-label="Загрузка"
      />
      <div class="h-64 animate-pulse rounded-2xl bg-surface" />
    </template>

    <template v-else-if="idea">
      <nav aria-label="Хлебные крошки">
        <NuxtLink
          to="/"
          class="text-sm text-muted-foreground hover:text-foreground"
        >← Воронка</NuxtLink>
      </nav>

      <header class="space-y-3">
        <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
          {{ idea.title }}
        </h1>
        <div class="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span class="rounded-full bg-primary-soft px-2.5 py-0.5 font-medium text-primary">
            {{ idea.funnelStage }}
          </span>
          <span class="rounded-full bg-surface-cream px-2.5 py-0.5 font-medium">Приоритет: {{ idea.priority }}</span>
          <span class="rounded-full bg-muted px-2.5 py-0.5 font-medium text-muted-foreground">
            v{{ idea.version }} · создана {{ new Date(idea.createdAt).toLocaleDateString('ru-RU') }}
          </span>
        </div>
      </header>

      <p
        v-if="actionError"
        class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        role="alert"
      >
        {{ actionError }}
      </p>

      <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div class="space-y-6">
          <section
            class="space-y-4 rounded-2xl border bg-card p-6"
            aria-labelledby="src-heading"
          >
            <h2
              id="src-heading"
              class="text-lg font-bold"
            >
              Исходная идея
            </h2>
            <p class="whitespace-pre-line text-sm leading-6">
              {{ idea.sourceTranscript }}
            </p>
            <p class="text-xs text-muted-foreground">
              Источник: {{ idea.sourceKind === 'voice' ? 'голосовая запись' : 'текст' }}
            </p>
          </section>

          <section
            v-if="idea.structuredIdea"
            class="space-y-4 rounded-2xl border bg-card p-6"
            aria-labelledby="struct-heading"
          >
            <h2
              id="struct-heading"
              class="text-lg font-bold"
            >
              Структура (аналитик идеи)
            </h2>
            <dl class="space-y-3 text-sm">
              <div
                v-for="(value, key) in idea.structuredIdea"
                :key="key"
                class="grid gap-1 sm:grid-cols-[180px_1fr]"
              >
                <dt class="font-medium text-muted-foreground">
                  {{ key }}
                </dt>
                <dd class="leading-6">
                  {{ typeof value === 'string' ? value : JSON.stringify(value) }}
                </dd>
              </div>
            </dl>
          </section>

          <section
            v-if="idea.problem || idea.audience || idea.value"
            class="space-y-4 rounded-2xl border bg-card p-6"
            aria-labelledby="detail-heading"
          >
            <h2
              id="detail-heading"
              class="text-lg font-bold"
            >
              Проблема, аудитория, ценность
            </h2>
            <div
              v-if="idea.problem"
              class="space-y-1"
            >
              <h3 class="text-sm font-medium text-muted-foreground">
                Проблема
              </h3>
              <p class="whitespace-pre-line text-sm leading-6">
                {{ idea.problem }}
              </p>
            </div>
            <div
              v-if="idea.audience"
              class="space-y-1"
            >
              <h3 class="text-sm font-medium text-muted-foreground">
                Аудитория
              </h3>
              <p class="whitespace-pre-line text-sm leading-6">
                {{ idea.audience }}
              </p>
            </div>
            <div
              v-if="idea.value"
              class="space-y-1"
            >
              <h3 class="text-sm font-medium text-muted-foreground">
                Ценность
              </h3>
              <p class="whitespace-pre-line text-sm leading-6">
                {{ idea.value }}
              </p>
            </div>
          </section>

          <div class="flex flex-wrap gap-3">
            <NuxtLink
              :to="`/ideas/${idea.id}/report`"
              class="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Открыть отчёт →
            </NuxtLink>
            <NuxtLink
              :to="`/ideas/${idea.id}/runs`"
              class="inline-flex h-12 items-center justify-center rounded-full border px-6 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Прогоны и эффективность
            </NuxtLink>
          </div>
        </div>

        <aside class="space-y-6">
          <JobProgress
            :busy="busy"
            :job="job"
            @cancel="jobAction('cancel')"
            @pause="jobAction('pause')"
            @rerun="runAnalysis"
            @resume="jobAction('resume')"
            @run="runAnalysis"
          />
        </aside>
      </div>
    </template>
  </div>
</template>
