<script setup lang="ts">
import type { CalculationRow } from '~~/shared/efficiency-view'

import { phaseTitle } from '~~/shared/phase-names'
import EfficiencyCard from '../report/EfficiencyCard.vue'
import RunsTables from './RunsTables.vue'

const route = useRoute()
const ideaId = route.params.id as string

// Технические блоки этого экрана (формулы, дампы параметров, журнал прогонов) —
// под «режимом разработчика» (Пункт 4 ТЗ). Владелец видит карточку эффекта.
const { enabled: devMode, set: setDevMode, sync: syncDevMode } = useDevMode()

const calculations = ref<CalculationRow[]>([])
const runs = ref<InstanceType<typeof RunsTables>['$props']['runs']>([])
const calls = ref<InstanceType<typeof RunsTables>['$props']['calls']>([])
const loading = ref(true)
const loadError = ref<null | string>(null)

const latest = computed(() => calculations.value[0] ?? null)

/** Сценарии из `result.result.scenarios` (то, что реально лежит в строке). */
const scenarios = computed<Array<[string, unknown]>>(() => {
  const inner = latest.value?.result as { result?: { scenarios?: unknown[] } } | undefined
  const list = inner?.result?.scenarios
  if (!Array.isArray(list)) {
    return []
  }
  return list.map((item, i) => {
    const obj = item as Record<string, unknown>
    return [String(obj.name ?? `#${i + 1}`), obj] as [string, unknown]
  })
})

function openTechnical(): void {
  setDevMode(true)
}

async function load(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const [calcData, runsData] = await Promise.all([
      $fetch<{ calculations: CalculationRow[] }>(`/api/ideas/${ideaId}/calculations`).catch(() => ({ calculations: [] })),
      $fetch<{ runs: typeof runs.value, calls: typeof calls.value }>(`/api/ideas/${ideaId}/runs`).catch(() => ({ calls: [], runs: [] })),
    ])
    calculations.value = calcData.calculations
    runs.value = runsData.runs
    calls.value = runsData.calls
  }
  catch (err: unknown) {
    loadError.value = (err as Error).message ?? 'Ошибка загрузки'
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  syncDevMode()
  void load()
})

function fmtDate(iso: null | string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2)
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}
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
        class="h-10 w-1/2 animate-pulse rounded bg-surface"
        role="status"
        aria-label="Загрузка"
      />
      <div class="h-64 animate-pulse rounded-2xl bg-surface" />
    </template>

    <template v-else>
      <nav aria-label="Хлебные крошки">
        <NuxtLink
          :to="`/ideas/${ideaId}`"
          class="text-sm text-muted-foreground hover:text-foreground"
        >← Карточка идеи</NuxtLink>
      </nav>

      <header class="space-y-2">
        <p class="text-sm font-medium text-muted-foreground">
          Прогоны и эффективность
        </p>
        <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
          Расчёт потенциального эффекта
        </h1>
        <p class="max-w-[70ch] text-sm leading-6 text-muted-foreground">
          Числа получены детерминированным серверным расчётом (не LLM): формулы, параметры и seed
          сохранены вместе с результатом и воспроизводимы при повторном запуске.
        </p>
      </header>

      <div
        v-if="!latest"
        class="rounded-xl border border-dashed bg-card p-10 text-center"
        role="status"
      >
        <p class="text-sm text-muted-foreground">
          Расчётов пока нет. Эффективность считается на фазе «{{ phaseTitle('efficiency_model') }}» после запуска анализа.
        </p>
      </div>

      <template v-else>
        <EfficiencyCard
          v-if="latest.view"
          :view="latest.view"
        />

        <button
          v-if="!devMode"
          type="button"
          class="inline-flex h-11 items-center self-start rounded-full border bg-background px-4 text-sm text-muted-foreground hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="openTechnical"
        >
          Технические детали
        </button>

        <section
          v-if="devMode"
          class="space-y-4 rounded-2xl border bg-card p-6"
          aria-labelledby="formula-heading"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="formula-heading"
              class="text-lg font-bold"
            >
              Формула и модель
            </h2>
            <span class="rounded-full bg-primary-soft px-2.5 py-0.5 text-[13px] font-medium text-primary">
              {{ latest.modelVersion }}
            </span>
          </div>
          <pre class="overflow-x-auto rounded-lg bg-surface p-4 text-sm leading-6">{{ latest.formula }}</pre>
          <p class="text-xs text-muted-foreground">
            Seed: {{ latest.seed }} · рассчитано {{ fmtDate(latest.createdAt) }}
          </p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 class="text-sm font-medium text-muted-foreground">
                Параметры
              </h3>
              <pre class="mt-1 max-h-48 overflow-auto rounded-lg bg-surface p-3 text-xs leading-5">{{ JSON.stringify(latest.params, null, 2) }}</pre>
            </div>
            <div>
              <h3 class="text-sm font-medium text-muted-foreground">
                Входные данные
              </h3>
              <pre class="mt-1 max-h-48 overflow-auto rounded-lg bg-surface p-3 text-xs leading-5">{{ JSON.stringify(latest.inputSummary, null, 2) }}</pre>
            </div>
          </div>
          <p
            v-if="latest.warnings"
            class="rounded-lg bg-accent/20 p-3 text-sm"
            role="status"
          >
            Предупреждения: {{ JSON.stringify(latest.warnings) }}
          </p>
        </section>

        <section
          v-if="devMode"
          class="space-y-4"
          aria-labelledby="scenarios-heading"
        >
          <h2
            id="scenarios-heading"
            class="text-lg font-bold"
          >
            Сценарии эффекта
          </h2>
          <div class="grid gap-4 sm:grid-cols-3">
            <div
              v-for="[name, data] in scenarios"
              :key="name"
              class="rounded-2xl border bg-card p-5"
            >
              <p class="text-[13px] font-medium text-muted-foreground">
                {{ name }}
              </p>
              <dl class="mt-2 space-y-1.5 text-sm">
                <div
                  v-for="(v, k) in (data as Record<string, unknown>)"
                  :key="k"
                  class="flex justify-between gap-2"
                >
                  <dt class="text-muted-foreground">
                    {{ k }}
                  </dt>
                  <dd class="font-medium">
                    {{ fmt(v) }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
      </template>

      <RunsTables
        v-if="devMode"
        :calls="calls"
        :runs="runs"
      />
    </template>
  </div>
</template>
