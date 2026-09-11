<script setup lang="ts">
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
