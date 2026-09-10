<script setup lang="ts">
import RunsTables from './RunsTables.vue'

interface Calculation {
  createdAt: string
  formula: string
  id: string
  inputSummary: Record<string, unknown>
  modelVersion: string
  params: Record<string, unknown>
  result: Record<string, unknown>
  seed: number | string
  warnings: unknown
}

const route = useRoute()
const ideaId = route.params.id as string

const calculations = ref<Calculation[]>([])
const runs = ref<InstanceType<typeof RunsTables>['$props']['runs']>([])
const calls = ref<InstanceType<typeof RunsTables>['$props']['calls']>([])
const loading = ref(true)
const loadError = ref<null | string>(null)

const latest = computed(() => calculations.value[0] ?? null)

const scenarios = computed(() => {
  const r = latest.value?.result
  if (!r) return []
  const sc = r.scenarios ?? r
  if (typeof sc !== 'object' || sc === null) return []
  return Object.entries(sc as Record<string, unknown>)
})

async function load(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const [calcData, runsData] = await Promise.all([
      $fetch<{ calculations: Calculation[] }>(`/api/ideas/${ideaId}/calculations`).catch(() => ({ calculations: [] })),
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

onMounted(load)

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
          Расчётов пока нет. Эффективность считается на шаге «efficiency_model» после запуска анализа.
        </p>
      </div>

      <template v-else>
        <section
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
        :calls="calls"
        :runs="runs"
      />
    </template>
  </div>
</template>
