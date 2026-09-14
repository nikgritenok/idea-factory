<script setup lang="ts">
// Соседей из app/features не автоимпортируют (Nuxt сканирует только app/components),
// поэтому импорт явный: без него секция молча не рендерилась.
import NextStepsList from './NextStepsList.vue'

defineProps<{
  steps: string[]
}>()
</script>

<template>
  <section
    class="space-y-4"
    aria-labelledby="next-steps-heading"
  >
    <h2
      id="next-steps-heading"
      class="text-lg font-bold"
    >
      Следующие шаги
    </h2>
    <NextStepsList :steps="steps" />
  </section>
</template>
