<script setup lang="ts">
// Компаньон из app/features не автоимпортируется (Nuxt сканирует только app/components):
// без явного импорта секция молча оставалась пустой.
import StopFactorCard from './StopFactorCard.vue'

interface StopFactor {
  description?: null | string
  reason?: null | string
  workaround?: null | string
}

defineProps<{
  factors: StopFactor[]
}>()
</script>

<template>
  <section
    class="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6"
    aria-labelledby="stop-heading"
  >
    <div class="flex flex-wrap items-center gap-3">
      <h2
        id="stop-heading"
        class="text-lg font-bold text-destructive"
      >
        Стоп-факторы
      </h2>
      <span class="rounded-full bg-destructive/15 px-3 py-1 text-[13px] font-medium text-destructive">
        {{ factors.length }}
      </span>
    </div>
    <p class="text-sm text-muted-foreground">
      Наличие стоп-факторов блокирует рекомендацию «Развивать» — сначала нужно закрыть их или проверить обходной путь.
    </p>
    <ul class="space-y-4">
      <StopFactorCard
        v-for="(factor, i) in factors"
        :key="i"
        :factor="factor"
        :index="i"
      />
    </ul>
  </section>
</template>
