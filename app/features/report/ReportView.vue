<script setup lang="ts">
import type { CalculationRow } from '~~/shared/efficiency-view'

import { isPhaseRole, phaseTitle } from '~~/shared/phase-names'
import MaterialViewer from '../ideas/MaterialViewer.vue'
import EfficiencyCard from './EfficiencyCard.vue'
import NextStepsSection from './NextStepsSection.vue'
import { nextSteps, RECOMMENDATION_LABELS, weaknesses } from './report-sections'
import StopFactorsSection from './StopFactorsSection.vue'
import WeaknessesSection from './WeaknessesSection.vue'

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
const calculation = ref<null | CalculationRow>(null)
const loading = ref(true)
const loadError = ref<null | string>(null)
const showRaw = ref(false)

// Технические окна (JSON-дампы, id ролей, флаги формата) — под «режимом
// разработчика», по умолчанию выключен (Пункт 4 ТЗ).
const { enabled: devMode, set: setDevMode, sync: syncDevMode } = useDevMode()
onMounted(syncDevMode)

/** Ссылка «Технические детали» в отчёте: включает режим и раскрывает журнал. */
function openTechnical(): void {
  setDevMode(true)
  showRaw.value = true
}

/** Актуальные выходы фаз — те, у которых есть что открыть. */
const materialPhases = computed(() => outputs.value.filter(o => !o.outdated && isPhaseRole(o.role)))

async function load(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const [ideaData, reportData, outputsData, calculationsData] = await Promise.all([
      fetchIdea(ideaId),
      $fetch<{ report: null | ReportData }>(`/api/ideas/${ideaId}/report`).catch(() => ({ report: null })),
      $fetch<{ outputs: AgentOutput[] }>(`/api/ideas/${ideaId}/outputs`).catch(() => ({ outputs: [] })),
      $fetch<{ calculations: CalculationRow[] }>(`/api/ideas/${ideaId}/calculations`).catch(() => ({ calculations: [] })),
    ])
    idea.value = ideaData
    report.value = reportData.report
    outputs.value = outputsData.outputs
    calculation.value = calculationsData.calculations[0] ?? null
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

const weaknessList = computed(() => weaknesses(report.value?.sections ?? []))
const nextStepList = computed(() => nextSteps(report.value?.sections ?? []))

const generalSections = computed(() =>
  (report.value?.sections ?? []).filter(
    section => !['weaknesses', 'nextSteps'].includes(section.key),
  ),
)
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
              Вывод ИИ-критика
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

        <EfficiencyCard
          v-if="calculation?.view"
          :view="calculation.view"
        />

        <StopFactorsSection
          v-if="stopFactorList.length"
          :factors="stopFactorList"
        />

        <WeaknessesSection
          v-if="weaknessList.length"
          :weaknesses="weaknessList"
        />

        <NextStepsSection
          v-if="nextStepList.length"
          :steps="nextStepList"
        />

        <section
          v-for="section in generalSections"
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
          class="space-y-4 rounded-2xl border bg-card p-6"
          aria-labelledby="sources-heading"
        >
          <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div class="space-y-1">
              <h2
                id="sources-heading"
                class="text-lg font-bold"
              >
                Материалы по фазам
              </h2>
              <p class="text-sm leading-6 text-muted-foreground">
                Что вернула каждая отработанная фаза. Открывается в один клик, можно скачать .md.
              </p>
            </div>
            <button
              v-if="!devMode"
              type="button"
              class="inline-flex h-11 shrink-0 items-center rounded-full border bg-background px-4 text-sm text-muted-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              @click="openTechnical"
            >
              Технические детали
            </button>
          </div>

          <ul
            v-if="materialPhases.length > 0"
            class="space-y-2"
          >
            <li
              v-for="out in materialPhases"
              :key="out.id"
              class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-surface p-3"
            >
              <span class="min-w-0 text-sm font-medium">{{ phaseTitle(out.role) }}</span>
              <span class="flex items-center gap-3">
                <span class="text-xs text-muted-foreground">{{ fmtDate(out.createdAt) }}</span>
                <MaterialViewer
                  :idea-id="ideaId"
                  :role="out.role"
                />
              </span>
            </li>
          </ul>
          <p
            v-else
            class="text-sm text-muted-foreground"
          >
            Материалов пока нет — ни одна фаза не завершилась с сохранённым выходом.
          </p>

          <template v-if="devMode">
            <div class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <div class="space-y-1">
                <h3 class="text-sm font-bold">
                  Журнал вызовов — режим разработчика
                </h3>
                <p class="text-xs text-muted-foreground">
                  Сырые выходы, id ролей и флаги формата. Владельцу это не нужно: выключается в «Настройках».
                </p>
              </div>
              <button
                type="button"
                class="inline-flex h-11 shrink-0 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :aria-expanded="showRaw"
                @click="showRaw = !showRaw"
              >
                {{ showRaw ? 'Скрыть' : 'Показать' }} raw ({{ outputs.length }})
              </button>
            </div>
            <ul
              v-if="showRaw"
              class="space-y-3"
            >
              <li
                v-for="out in outputs"
                :key="out.id"
                class="rounded-xl bg-surface p-4"
              >
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <span class="font-mono text-xs">{{ out.role }}</span>
                  <span class="text-xs text-muted-foreground">{{ fmtDate(out.createdAt) }}</span>
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
                <pre class="mt-2 max-h-64 overflow-auto rounded-lg bg-card p-3 font-mono text-[11px] leading-4">{{ renderValue(out.output) }}</pre>
              </li>
            </ul>
          </template>
        </section>
      </template>
    </template>
  </div>
</template>
