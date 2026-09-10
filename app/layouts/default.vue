<script setup lang="ts">
const route = useRoute()

const navItems = [
  { icon: 'i-lucide-kanban', label: 'Воронка', to: '/ideas' },
  { icon: 'i-lucide-mic', label: 'Новая идея', to: '/ideas/new' },
  { icon: 'i-lucide-settings', label: 'Настройки и документация', to: '/settings' },
] as const

function isActive(to: string): boolean {
  return to === '/ideas' ? route.path === '/ideas' || route.path.startsWith('/ideas/') : route.path.startsWith(to)
}
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <header class="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div class="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-4 md:px-8">
        <NuxtLink
          to="/"
          class="flex items-center gap-2.5"
        >
          <span
            class="inline-flex size-9 items-center justify-center rounded-full bg-accent text-lg"
            aria-hidden="true"
          >☀</span>
          <span class="text-lg font-bold tracking-tight">Фабрика идей</span>
        </NuxtLink>

        <nav aria-label="Основная навигация">
          <ul class="flex items-center gap-1 sm:gap-2">
            <li
              v-for="item in navItems"
              :key="item.to"
            >
              <NuxtLink
                :to="item.to"
                class="rounded-full px-4 py-2 text-sm font-medium transition-colors"
                :class="isActive(item.to)
                  ? 'bg-primary-soft text-primary'
                  : 'text-foreground hover:bg-surface'"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-[1200px] px-4 pb-24 pt-8 md:px-8">
      <slot />
    </main>
  </div>
</template>
