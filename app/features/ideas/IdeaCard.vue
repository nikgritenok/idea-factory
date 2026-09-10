<script setup lang="ts">
import type { JobSummary } from '../jobs/types'

import { FUNNEL_LABELS, PRIORITY_LABELS } from './types'
import JobProgress from '../jobs/JobProgress.vue'
import { extractApiMessage } from './types'

const route = useRoute()
const ideaId = route.params.id as string
const isDemo = computed(() => route.query.demo === '1')

const idea = ref<Awaited<ReturnType<typeof fetchIdea>>>(null)
const job = ref<JobSummary | null>(null)
const loading = ref(true)
const loadError = ref<null | string>(null)
const actionError = ref<null | string>(null)
const busy = ref(false)

// MVP state
const ticketText = ref('')
const mvpBusy = ref(false)
const mvpResult = ref<null | { classification: unknown, validated: boolean, errors: string[] }>(null)
const mvpError = ref<null | string>(null)

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

async function submitMvp(): Promise<void> {
  if (!ticketText.value.trim()) return
  mvpBusy.value = true
  mvpError.value = null
  mvpResult.value = null
  try {
    const data = await $fetch<{ classification: unknown, validated: boolean, errors: string[] }>(`/api/ideas/${ideaId}/mvp`, {
      method: 'POST',
      body: { ticketText: ticketText.value.trim() },
    })
    mvpResult.value = data
  }
  catch (err: unknown) {
    mvpError.value = extractApiMessage(err)
  }
  finally {
    mvpBusy.value = false
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

      <div
        v-if="isDemo"
        class="rounded-lg border border-secondary bg-secondary/5 px-4 py-2 text-sm text-secondary"
      >
        Режим демо (только просмотр). Для полного доступа откройте без параметра ?demo=1
      </div>

      <header class="space-y-3">
        <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
          {{ idea.title }}
        </h1>
        <div class="flex flex-wrap items-center gap-1.5 text-[13px]">
          <span class="rounded-full bg-primary-soft px-2.5 py-0.5 font-medium text-primary">
            {{ FUNNEL_LABELS[idea.funnelStage] ?? idea.funnelStage }}
          </span>
          <span class="rounded-full bg-surface-cream px-2.5 py-0.5 font-medium">Приоритет: {{ PRIORITY_LABELS[idea.priority] ?? idea.priority }}</span>
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

          <section
            v-if="idea.funnelStage === 'decision' && !isDemo"
            class="space-y-4 rounded-2xl border border-secondary bg-secondary/5 p-6"
            aria-labelledby="mvp-heading"
          >
            <h2
              id="mvp-heading"
              class="text-lg font-bold text-secondary"
            >
              MVP: Тест обращения
            </h2>
            <p class="text-sm text-muted-foreground">
              Введите текст обращения клиента — система классифицирует его и проверит правилами.
            </p>
            <form
              class="space-y-3"
              @submit.prevent="submitMvp"
            >
              <textarea
                v-model="ticketText"
                class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows="3"
                placeholder="Здравствуйте, у меня не работает оплата на сайте..."
                aria-label="Текст обращения клиента"
              />
              <button
                type="submit"
                :disabled="mvpBusy || !ticketText.trim()"
                class="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-medium text-on-secondary hover:bg-secondary/90 disabled:opacity-50"
              >
                <Icon
                  v-if="mvpBusy"
                  name="lucide:loader-2"
                  class="size-4 animate-spin"
                />
                {{ mvpBusy ? 'Обработка...' : 'Проверить обращение' }}
              </button>
            </form>
            <p
              v-if="mvpError"
              class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {{ mvpError }}
            </p>
            <div
              v-if="mvpResult"
              class="space-y-3 rounded-lg border bg-card p-4 text-sm"
            >
              <div class="flex items-center gap-2">
                <Icon
                  :name="mvpResult.validated ? 'lucide:check-circle-2' : 'lucide:x-circle'"
                  :class="mvpResult.validated ? 'text-success' : 'text-destructive'"
                  class="size-5"
                />
                <span
                  :class="mvpResult.validated ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive'"
                  class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                >
                  {{ mvpResult.validated ? 'Пройдено' : 'Ошибка валидации' }}
                </span>
                <span class="font-medium">Классификация</span>
              </div>
              <dl
                v-if="mvpResult.classification"
                class="grid gap-1 sm:grid-cols-[140px_1fr]"
              >
                <div
                  v-for="(value, key) in mvpResult.classification as Record<string, unknown>"
                  :key="key"
                  class="contents"
                >
                  <dt class="text-muted-foreground">{{ key }}</dt>
                  <dd>{{ typeof value === 'string' ? value : JSON.stringify(value) }}</dd>
                </div>
              </dl>
              <ul
                v-if="mvpResult.errors?.length"
                class="list-disc pl-5 text-destructive"
              >
                <li
                  v-for="(err, idx) in mvpResult.errors"
                  :key="idx"
                >
                  {{ err }}
                </li>
              </ul>
            </div>
          </section>

          <div class="flex flex-wrap gap-3">
            <NuxtLink
              :to="`/ideas/${idea.id}/report`"
              class="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Открыть отчёт
              <Icon name="lucide:arrow-right" class="size-4" />
            </NuxtLink>
            <NuxtLink
              :to="`/ideas/${idea.id}/runs`"
              class="inline-flex h-12 items-center gap-2 rounded-full border px-6 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Icon name="lucide:bar-chart-3" class="size-4" />
              Прогоны и эффективность
            </NuxtLink>
          </div>
        </div>

        <aside class="space-y-6">
          <JobProgress
            :busy="busy"
            :job="job"
            :readonly="isDemo"
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
