<script setup lang="ts">
export interface Weakness {
  description?: null | string
  mitigation?: null | string
  severity?: null | string
}

const props = defineProps<{
  weakness: Weakness
}>()

const SEVERITY: Record<string, { className: string, label: string }> = {
  critical: { className: 'bg-destructive text-white', label: 'Критично' },
  high: { className: 'bg-tertiary text-foreground', label: 'Высокий' },
  low: { className: 'bg-surface text-muted-foreground', label: 'Низкий' },
  medium: { className: 'bg-secondary-soft text-foreground', label: 'Средний' },
}

const severity = computed(() => {
  const found = props.weakness.severity ? SEVERITY[props.weakness.severity] : undefined
  return found ?? { className: 'bg-surface text-muted-foreground', label: 'Серьёзность не указана' }
})

function text(value: null | string | undefined): string {
  return value?.trim() ? value : '—'
}
</script>

<template>
  <li class="rounded-2xl border bg-card p-6">
    <div class="flex flex-wrap items-center gap-3">
      <span
        class="rounded-full px-3 py-1 text-[13px] font-medium"
        :class="severity.className"
      >
        {{ severity.label }}
      </span>
    </div>
    <div class="mt-3 space-y-3">
      <div>
        <h3 class="text-[13px] font-medium text-muted-foreground">
          Слабое место
        </h3>
        <p class="mt-1 font-medium leading-6">
          {{ text(weakness.description) }}
        </p>
      </div>
      <div
        v-if="weakness.mitigation?.trim()"
        class="rounded-xl bg-surface p-4"
      >
        <h4 class="text-[13px] font-medium text-muted-foreground">
          Как смягчить
        </h4>
        <p class="mt-1 text-sm leading-6">
          {{ text(weakness.mitigation) }}
        </p>
      </div>
    </div>
  </li>
</template>
