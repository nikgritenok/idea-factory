<script setup lang="ts">
/**
 * Сводка отчёта в карточке идеи.
 *
 * Отчёт жил только на отдельной странице, и в карточке оставалась одна ссылка:
 * владелец не видел вывода, не открывая второй экран. Здесь — то, ради чего
 * прогон и запускают: рекомендация, балл, главная цифра эффекта и первые шаги.
 * Полные материалы и обоснование остаются на странице отчёта.
 *
 * Отдельный компонент ещё и потому, что IdeaCard упирался в лимит max-lines.
 */
import type { CalculationRow } from '~~/shared/efficiency-view'
import { phaseTitle } from '~~/shared/phase-names'
import { nextSteps, RECOMMENDATION_LABELS, weaknesses } from '../report/report-sections'

interface ReportSection {
  content: unknown
  key: string
  title: string
}

interface ReportData {
  createdAt: string
  recommendation: null | string
  score: null | string
  sections: ReportSection[]
  version: number
}

const props = defineProps<{ ideaId: string }>()

const report = ref<null | ReportData>(null)
const calculation = ref<null | CalculationRow>(null)

const TONE_CLASSES: Record<string, string> = {
  develop: 'bg-success-soft text-success',
  insufficient_data: 'bg-surface-cream text-foreground',
  postpone: 'bg-accent/25 text-accent-foreground',
  reject: 'bg-destructive/10 text-destructive',
  validate_first: 'bg-surface-cream text-foreground',
}

async function load(): Promise<void> {
  const [reportData, calcData] = await Promise.all([
    $fetch<{ report: null | ReportData }>(`/api/ideas/${props.ideaId}/report`).catch(() => ({ report: null })),
    $fetch<{ calculations: CalculationRow[] }>(`/api/ideas/${props.ideaId}/calculations`).catch(() => ({ calculations: [] })),
  ])
  report.value = reportData.report
  calculation.value = calcData.calculations[0] ?? null
}

onMounted(load)

const badgeClass = computed(() => TONE_CLASSES[report.value?.recommendation ?? ''] ?? 'bg-surface text-muted-foreground')
const recommendationLabel = computed(() => RECOMMENDATION_LABELS[report.value?.recommendation ?? ''] ?? 'Решение ещё не сформулировано')
const stepList = computed(() => nextSteps(report.value?.sections ?? []).slice(0, 3))
const weaknessTop = computed(() => weaknesses(report.value?.sections ?? []).filter(w => w.description).slice(0, 2))
const efficiencyLine = computed(() => {
  const view = calculation.value?.view
  if (!view) {
    return null
  }
  const { before, after, fasterPercent } = view.headline
  return {
    headline: fasterPercent === null ? `${before} → ${after}` : `${before} → ${after} · ${fasterPercent}% быстрее`,
    volume: `${view.volume.hours} в месяц`,
  }
})

const shown = computed(() => report.value !== null)
</script>

<template>
  <section
    v-if="shown"
    class="space-y-4 rounded-2xl border bg-card p-6"
    aria-labelledby="report-summary-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <h2
        id="report-summary-heading"
        class="text-lg font-bold"
      >
        Отчёт по идее
      </h2>
      <span class="text-xs text-muted-foreground">
        v{{ report?.version }} · {{ new Date(report?.createdAt ?? '').toLocaleDateString('ru-RU') }}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <span
        class="rounded-full px-4 py-2 text-[15px] font-bold"
        :class="badgeClass"
      >
        {{ recommendationLabel }}
      </span>
      <span class="text-sm text-muted-foreground">
        Оценка: <span class="font-medium text-foreground">{{ report?.score ?? '—' }} / 10</span>
      </span>
    </div>

    <div
      v-if="efficiencyLine"
      class="rounded-xl bg-surface p-4"
    >
      <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {{ phaseTitle('efficiency_analyst') }}
      </p>
      <p class="mt-1 text-[20px] font-bold leading-snug text-primary">
        {{ efficiencyLine.headline }}
      </p>
      <p class="text-sm text-muted-foreground">
        Экономия на объёме: {{ efficiencyLine.volume }}
      </p>
    </div>

    <div
      v-if="stepList.length > 0"
      class="space-y-1.5"
    >
      <h3 class="text-sm font-medium text-muted-foreground">
        Что делать дальше
      </h3>
      <ol class="space-y-1 text-sm leading-6">
        <li
          v-for="(step, i) in stepList"
          :key="i"
          class="flex gap-2"
        >
          <span
            class="text-muted-foreground"
            aria-hidden="true"
          >{{ i + 1 }}.</span>
          <span>{{ step }}</span>
        </li>
      </ol>
    </div>

    <div
      v-if="weaknessTop.length > 0"
      class="space-y-1.5"
    >
      <h3 class="text-sm font-medium text-muted-foreground">
        Главное из критики
      </h3>
      <ul class="space-y-1 text-sm leading-6">
        <li
          v-for="(item, i) in weaknessTop"
          :key="i"
          class="flex gap-2"
        >
          <span
            class="text-destructive"
            aria-hidden="true"
          >•</span>
          <span>
            {{ item.description }}
            <span
              v-if="item.mitigation"
              class="text-muted-foreground"
            >— как снизить: {{ item.mitigation }}</span>
          </span>
        </li>
      </ul>
    </div>

    <NuxtLink
      :to="`/ideas/${ideaId}/report`"
      class="inline-flex h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      Открыть отчёт целиком
      <Icon
        name="lucide:arrow-right"
        class="size-4"
      />
    </NuxtLink>
  </section>
</template>
