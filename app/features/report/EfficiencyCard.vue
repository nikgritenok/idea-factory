<script setup lang="ts">
/**
 * Карточка эффективности (Пункт 3 ТЗ).
 *
 * Всё, что здесь показывается, приходит с сервера в `view` (см.
 * server/utils/efficiency-view.ts): компонент намеренно НЕ считает проценты,
 * средние и CI — правило TZ §5 оставляет числовую логику на сервере.
 * Здесь только раскладка и подписи.
 */
import type { EfficiencyView } from '~~/shared/efficiency-view'

const props = defineProps<{ view: EfficiencyView }>()

const TONE_CLASSES: Record<EfficiencyView['badgeTone'], string> = {
  neutral: 'bg-surface-cream text-foreground',
  positive: 'bg-success-soft text-success',
  risk: 'bg-destructive/10 text-destructive',
  warn: 'bg-accent/25 text-accent-foreground',
}

const badgeClass = computed(() => TONE_CLASSES[props.view.badgeTone] ?? TONE_CLASSES.neutral)

/** Заголовок «6 мин → 2,3 мин (61% быстрее)» — без percent, если он не определён. */
const headline = computed(() => {
  const { after, before, fasterPercent } = props.view.headline
  const arrow = `${before} → ${after}`
  return fasterPercent === null ? arrow : `${arrow} (${fasterPercent}% быстрее)`
})
</script>

<template>
  <section
    class="space-y-5 rounded-2xl border bg-card p-6"
    aria-labelledby="efficiency-heading"
  >
    <div class="space-y-1">
      <h2
        id="efficiency-heading"
        class="text-lg font-bold"
      >
        Потенциальный эффект
      </h2>
      <p class="text-[20px] font-bold leading-snug text-primary sm:text-[24px]">
        {{ headline }}
      </p>
      <p class="text-sm leading-6 text-muted-foreground">
        {{ view.methodLine }}
      </p>
    </div>

    <dl class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-xl bg-surface p-4">
        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          На одну заявку
        </dt>
        <dd class="mt-1 text-[22px] font-bold leading-tight">
          {{ view.perTicket.from }} → {{ view.perTicket.to }}
        </dd>
      </div>
      <div class="rounded-xl bg-surface p-4">
        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          На объём ({{ view.volume.tickets }} заявок)
        </dt>
        <dd class="mt-1 text-[22px] font-bold leading-tight">
          {{ view.volume.hours }} / мес
        </dd>
      </div>
      <div class="rounded-xl bg-surface p-4">
        <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Доверительный интервал
        </dt>
        <dd
          v-if="view.ci"
          class="mt-1 text-[22px] font-bold leading-tight"
        >
          {{ view.ci.level }}: {{ view.ci.text }}
        </dd>
        <dd
          v-else
          class="mt-1 text-sm leading-6 text-muted-foreground"
        >
          Интервал не показываем: наблюдений меньше двух, разброса bootstrap не дал
        </dd>
      </div>
    </dl>

    <div class="space-y-2">
      <h3 class="text-sm font-bold">
        Три сценария
      </h3>
      <ul class="space-y-1 text-sm">
        <li
          v-for="scenario in view.scenarios"
          :key="scenario.label"
          class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg bg-surface/60 px-3 py-2"
        >
          <span class="font-medium">{{ scenario.label }}</span>
          <span class="text-muted-foreground">
            {{ scenario.effect }} на заявку · {{ scenario.volume }} в месяц · качество {{ scenario.quality }}
          </span>
        </li>
      </ul>
    </div>

    <div
      v-if="view.decision"
      class="space-y-3 rounded-xl border p-4"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-muted-foreground">Решение по расчёту:</span>
        <span
          class="rounded-full px-4 py-2 text-[15px] font-bold"
          :class="badgeClass"
        >
          {{ view.decision.label }}
        </span>
      </div>
      <p class="text-sm leading-6">
        {{ view.decision.threshold }}
      </p>
      <ul
        v-if="view.decision.triggeredRules.length > 0"
        class="space-y-1 text-sm text-muted-foreground"
      >
        <li
          v-for="rule in view.decision.triggeredRules"
          :key="rule"
          class="flex gap-2"
        >
          <span
            class="text-destructive"
            aria-hidden="true"
          >•</span>
          <span>{{ rule }}</span>
        </li>
      </ul>
    </div>

    <details class="group rounded-xl bg-surface p-4">
      <summary class="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        Как считали
      </summary>
      <div class="mt-3 space-y-4 text-sm">
        <div v-if="view.howCalculated.formula.length > 0">
          <h4 class="font-medium">
            Формулы
          </h4>
          <ul class="mt-1 space-y-1">
            <li
              v-for="(formula, i) in view.howCalculated.formula"
              :key="i"
              class="font-mono text-xs leading-5 break-words"
            >
              {{ formula }}
            </li>
          </ul>
        </div>

        <div v-if="view.howCalculated.units.length > 0">
          <h4 class="font-medium">
            Единицы
          </h4>
          <ul class="mt-1 space-y-0.5 text-muted-foreground">
            <li
              v-for="unit in view.howCalculated.units"
              :key="unit.label"
            >
              {{ unit.label }} — {{ unit.value }}
            </li>
          </ul>
        </div>

        <div v-if="view.howCalculated.params.length > 0">
          <h4 class="font-medium">
            Параметры модели
          </h4>
          <dl class="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-muted-foreground sm:grid-cols-2">
            <div
              v-for="param in view.howCalculated.params"
              :key="param.label"
              class="flex justify-between gap-3"
            >
              <dt>{{ param.label }}</dt>
              <dd class="font-mono">
                {{ param.value }}
              </dd>
            </div>
          </dl>
        </div>

        <p v-if="view.howCalculated.modelVersion" class="text-xs text-muted-foreground">
          Модель: {{ view.howCalculated.modelVersion }} · seed {{ view.howCalculated.seed }}
        </p>

        <ul
          v-if="view.howCalculated.warnings.length > 0"
          class="space-y-1"
        >
          <li
            v-for="warning in view.howCalculated.warnings"
            :key="warning"
            class="rounded-lg bg-surface-cream px-3 py-2 text-xs leading-5"
          >
            {{ warning }}
          </li>
        </ul>
      </div>
    </details>
  </section>
</template>
