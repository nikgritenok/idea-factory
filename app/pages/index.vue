<script setup lang="ts">
useSeoMeta({ title: 'Фабрика идей' })
useHead({
  title: 'Фабрика идей',
})

const sections = [
  {
    description: 'Все идеи, приоритеты, этапы воронки и очередь анализа.',
    icon: 'i-lucide-kanban',
    title: 'Воронка',
    to: '/ideas',
  },
  {
    description: 'Продиктуйте или опишите идею текстом — она станет карточкой и встанет в очередь.',
    icon: 'i-lucide-mic',
    title: 'Новая идея',
    to: '/ideas/new',
  },
  {
    description: 'Параметры пайплайна, лимиты очереди, документация и журнал разработки.',
    icon: 'i-lucide-settings',
    title: 'Настройки и документация',
    to: '/settings',
  },
] as const
</script>

<template>
  <div class="space-y-12">
    <section class="space-y-4">
      <h1 class="text-[44px] font-medium leading-[1.25] tracking-[-0.01em] text-primary">
        Фабрика идей
      </h1>
      <p class="max-w-2xl text-lg leading-7 text-muted-foreground">
        Продиктуйте или напишите идею ИИ-решения — сервис поставит её в очередь, проведёт
        исследование, посчитает потенциальный эффект по проверяемой модели и выдаст критический
        отчёт с рекомендацией.
      </p>
    </section>

    <ul
      class="grid gap-4 md:grid-cols-3"
      aria-label="Разделы сервиса"
    >
      <li
        v-for="section in sections"
        :key="section.to"
      >
        <NuxtLink
          :to="section.to"
          class="block h-full space-y-3 rounded-2xl border bg-card p-6 transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            class="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary"
            aria-hidden="true"
          >
            <span :class="section.icon" />
          </span>
          <h2 class="text-lg font-bold">
            {{ section.title }}
          </h2>
          <p class="text-sm leading-6 text-muted-foreground">
            {{ section.description }}
          </p>
          <span class="text-sm font-medium text-primary">{{ section.title }} →</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
