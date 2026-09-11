<script setup lang="ts">
const props = defineProps<{
  steps: string[]
}>()

const items = computed(() =>
  props.steps
    .map(step => typeof step === 'string' ? step.trim() : '')
    .filter(step => step.length > 0),
)
</script>

<template>
  <ol class="space-y-3">
    <li
      v-for="(step, i) in items"
      :key="i"
      class="flex gap-4 rounded-2xl border bg-card p-4"
    >
      <span
        aria-hidden="true"
        class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
      >{{ i + 1 }}</span>
      <p class="min-w-0 self-center text-sm leading-6">
        {{ step }}
      </p>
    </li>
  </ol>
</template>
