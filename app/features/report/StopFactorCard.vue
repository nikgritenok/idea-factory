<script setup lang="ts">
export interface StopFactor {
  description?: null | string
  reason?: null | string
  workaround?: null | string
}

defineProps<{
  factor: StopFactor
  index: number
}>()

function text(value: null | string | undefined): string {
  return value?.trim() ? value : '—'
}
</script>

<template>
  <li class="relative overflow-hidden rounded-2xl border border-destructive/30 bg-card">
    <span
      aria-hidden="true"
      class="absolute inset-y-0 left-0 w-1 bg-destructive"
    />
    <div class="flex gap-4 p-6 pl-7">
      <span
        aria-hidden="true"
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive text-sm font-bold text-white"
      >{{ index + 1 }}</span>
      <div class="min-w-0 space-y-3">
        <div>
          <h3 class="text-[13px] font-medium text-muted-foreground">
            Что блокирует
          </h3>
          <p class="mt-1 font-medium leading-6">
            {{ text(factor.reason) }}
          </p>
        </div>
        <div>
          <h4 class="text-[13px] font-medium text-muted-foreground">
            Почему
          </h4>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            {{ text(factor.description) }}
          </p>
        </div>
        <div
          v-if="factor.workaround?.trim()"
          class="rounded-xl bg-surface p-4"
        >
          <h4 class="text-[13px] font-medium text-muted-foreground">
            Как обойти
          </h4>
          <p class="mt-1 text-sm leading-6">
            {{ text(factor.workaround) }}
          </p>
        </div>
      </div>
    </div>
  </li>
</template>
