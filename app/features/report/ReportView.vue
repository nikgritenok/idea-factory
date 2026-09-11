<script setup lang="ts">
interface ReportSection {
  content: unknown
  key: string
  title: string
}

interface ReportData {
  createdAt: string
  id: string
  recommendation: null | string
  score: null | string
  sections: ReportSection[]
  stopFactors: unknown
  version: number
}

interface AgentOutput {
  createdAt: string
  formatValid: boolean
  id: string
  outdated: boolean
  output: unknown
  role: string
  validationError: null | string
}

interface StopFactor { description?: null | string, reason?: null | string, workaround?: null | string }

const route = useRoute()
const ideaId = route.params.id as string

const idea = ref<Awaited<ReturnType<typeof fetchIdea>>>(null)
const report = ref<null | ReportData>(null)
const outputs = ref<AgentOutput[]>([])
const loading = ref(true)
const loadError = ref<null | string>(null)
const showRaw = ref(false)

const RECOMMENDATION_LABELS: Record<string, string> = {
  develop: 'Развивать',
  insufficient_data: 'Недостаточно данных',
  postpone: 'Отложить',
  reject: 'Отклонить',
  validate_first: 'Сначала провалидировать',
}

const ROLE_LABELS: Record<string, string> = {
  critic: 'Критик',
  efficiency_analyst: 'Аналитик эффективности',
  idea_analyst: 'Аналитик идеи',
  market_analyst: 'Аналитик рынка',
  orchestrator: 'Оркестратор',
  report_editor: 'Редактор отчёта',
  strategist: 'Стратег',
}

async function load(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const [ideaData, reportData, outputsData] = await Promise.all([
      fetchIdea(ideaId),
      $fetch<{ report: null | ReportData }>(`/api/ideas/${ideaId}/report`).catch(() => ({ report: null })),
      $fetch<{ outputs: AgentOutput[] }>(`/api/ideas/${ideaId}/outputs`).catch(() => ({ outputs: [] })),
    ])
    idea.value = ideaData
    report.value = reportData.report
    outputs.value = outputsData.outputs
    if (!idea.value) loadError.value = 'Идея не найдена'
  }
  catch (err: unknown) {
    loadError.value = (err as Error)?.message ?? 'Ошибка загрузки'
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

function fmtDate(iso: null | string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

const stopFactorList = computed<StopFactor[]>(() => {
  const raw = report.value?.stopFactors
  if (!raw) return []
  const list: unknown[] = Array.isArray(raw) ? raw : Object.values(raw)
  return list.filter((item): item is StopFactor =>
    typeof item === 'object' && item !== null,
  )
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
        :to="`/ideas/${ideaId}`"
        class="ml-2 underline"
      >К карточке идеи</NuxtLink>
    </p>

    <template v-else-if="loading">
      <div
        class="h-10 w-2/3 animate-pulse rounded bg-surface"
        role="status"
        aria-label="Загрузка"
      />
      <div class="h-96 animate-pulse rounded-2xl bg-surface" />
    </template>

    <template v-else>
      <nav aria-label="Хлебные крошки">
        <NuxtLink
          :to="`/ideas/${ideaId}`"
          class="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Карточка идеи
        </NuxtLink>
      </nav>

      <header class="space-y-3">
        <p class="text-sm font-medium text-muted-foreground">
          Отчёт · {{ idea?.title }}
        </p>
        <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
          Критическая оценка и эффективность
        </h1>
      </header>

      <div
        v-if="!report"
        class="rounded-xl border border-dashed bg-card p-10 text-center"
        role="status"
      >
        <p class="text-sm text-muted-foreground">
          Отчёт ещё не собран. Запустите анализ идеи — после завершения пайплайна отчёт появится здесь.
        </p>
        <NuxtLink
          :to="`/ideas/${ideaId}`"
          class="mt-4 inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          К карточке — запустить анализ
        </NuxtLink>
      </div>

      <template v-else>
        <section
          class="grid gap-4 sm:grid-cols-3"
          aria-label="Сводка решения"
        >
          <div
            class="rounded-2xl p-5"
            :class="report.recommendation === 'develop' ? 'bg-success-soft' : 'bg-surface-cream'"
          >
            <p class="text-[13px] font-medium text-muted-foreground">
              Рекомендация
            </p>
            <p class="mt-1 text-xl font-bold">
              {{ RECOMMENDATION_LABELS[report.recommendation ?? ''] ?? report.recommendation ?? '—' }}
            </p>
          </div>
          <div class="rounded-2xl bg-primary-container p-5 text-primary-foreground">
            <p class="text-[13px] font-medium opacity-80">
              Общий балл
            </p>
            <p class="mt-1 text-xl font-bold">
              {{ report.score ?? '—' }} / 10
            </p>
          </div>
          <div class="rounded-2xl bg-surface p-5">
            <p class="text-[13px] font-medium text-muted-foreground">
              Версия отчёта
            </p>
            <p class="mt-1 text-xl font-bold">
              v{{ report.version }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ fmtDate(report.createdAt) }}
            </p>
          </div>
        </section>

        <StopFactorsSection
          v-if="stopFactorList.length"
          :factors="stopFactorList"
        />

        <section
          v-for="section in report.sections"
          :key="section.key"
          class="space-y-3 rounded-2xl border bg-card p-6"
          :aria-labelledby="`section-${section.key}`"
        >
          <h2
            :id="`section-${section.key}`"
            class="text-lg font-bold"
          >
            {{ section.title }}
          </h2>
          <pre class="whitespace-pre-wrap font-sans text-sm leading-6">{{ renderValue(section.content) }}</pre>
        </section>

        <section
          class="space-y-4 rounded-2xl bg-inverse-surface p-6 text-inverse-on-surface"
          aria-labelledby="sources-heading"
        >
          <h2
            id="sources-heading"
            class="text-lg font-bold"
          >
            Выходы агентов (журнал)
          </h2>
          <p class="text-sm opacity-70">
            Полные выходы каждой роли пайплайна — для проверки обоснованности.
          </p>
          <button
            type="button"
            class="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            :aria-expanded="showRaw"
            @click="showRaw = !showRaw"
          >
            {{ showRaw ? 'Скрыть' : 'Показать' }} журнал ({{ outputs.length }})
          </button>
          <ul
            v-if="showRaw"
            class="space-y-3"
          >
            <li
              v-for="out in outputs"
              :key="out.id"
              class="rounded-xl bg-white/5 p-4"
            >
              <div class="flex flex-wrap items-center gap-2 text-sm">
                <span class="font-medium">{{ ROLE_LABELS[out.role] ?? out.role }}</span>
                <span class="opacity-60">{{ fmtDate(out.createdAt) }}</span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs"
                  :class="out.formatValid ? 'bg-success-soft text-success' : 'bg-destructive/20 text-destructive'"
                >
                  {{ out.formatValid ? 'формат ок' : 'битый формат' }}
                </span>
                <span
                  v-if="out.outdated"
                  class="rounded-full bg-accent/20 px-2 py-0.5 text-xs"
                >устарел</span>
              </div>
              <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-sans text-xs leading-5 opacity-80">{{ renderValue(out.output) }}</pre>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>
