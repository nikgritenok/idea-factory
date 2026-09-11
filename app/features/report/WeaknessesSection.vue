<script setup lang="ts">
defineProps<{
  weaknesses: { description?: null | string, mitigation?: null | string, severity?: null | string }[]
}>()
</script>

<template>
  <section
    class="space-y-4"
    aria-labelledby="weaknesses-heading"
  >
    <h2
      id="weaknesses-heading"
      class="text-lg font-bold"
    >
      Слабые места
    </h2>
    <ul class="space-y-4">
      <WeaknessCard
        v-for="(weakness, i) in weaknesses"
        :key="i"
        :weakness="weakness"
      />
    </ul>
  </section>
</template>
