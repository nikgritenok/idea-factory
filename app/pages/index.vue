<script setup lang="ts">
useSeoMeta({ title: 'Фабрика идей' })
useHead({
  title: 'Фабрика идей',
})

const sections = [
  {
    description: 'Все идеи, приоритеты, этапы воронки и очередь анализа.',
    icon: 'lucide:kanban',
    title: 'Воронка',
    to: '/ideas',
  },
  {
    description: 'Продиктуйте или опишите идею текстом — она станет карточкой и встанет в очередь.',
    icon: 'lucide:mic',
    title: 'Новая идея',
    to: '/ideas/new',
  },
  {
    description: 'Параметры пайплайна, лимиты очереди, документация и журнал разработки.',
    icon: 'lucide:settings',
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
      <p class="text-lg leading-7 text-muted-foreground" style="max-width: 42rem; text-wrap: balance;">
        Продиктуйте или напишите идею ИИ-решения — сервис поставит её в очередь, проведёт
        исследование, посчитает потенциальный эффект по проверяемой модели и выдаст критический
        отчёт с рекомендацией.
      </p>
    </section>

    <ul
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Разделы сервиса"
    >
      <li
        v-for="section in sections"
        :key="section.to"
      >
        <NuxtLink
          :to="section.to"
          class="group flex h-full flex-col space-y-3 rounded-2xl border bg-card p-6 transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            class="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary transition-transform duration-200 group-hover:scale-110"
            aria-hidden="true"
          >
            <Icon :name="section.icon" class="size-5" />
          </span>
          <h2 class="text-lg font-bold">
            {{ section.title }}
          </h2>
          <p class="text-sm leading-6 text-muted-foreground">
            {{ section.description }}
          </p>
          <span class="mt-auto pt-2 text-sm font-medium text-primary">{{ section.title }} →</span>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
