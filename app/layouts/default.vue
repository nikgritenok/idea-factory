<script setup lang="ts">
const route = useRoute()

const navItems = [
  { icon: 'lucide:mic', label: 'Новая идея', to: '/' },
  { icon: 'lucide:list', label: 'Список идей', to: '/ideas' },
  { icon: 'lucide:settings', label: 'Настройки', to: '/settings' },
] as const

function isActive(to: string): boolean {
  if (to === '/ideas') {
    return route.path === '/ideas' || (/^\/ideas\/[a-f0-9-]+$/.test(route.path))
  }
  if (to === '/') {
    return route.path === '/'
  }
  return route.path === to
}
</script>

<template>
  <div class="min-h-dvh bg-background text-foreground">
    <header class="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div class="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6 md:px-16">
        <NuxtLink
          to="/"
          class="flex items-center gap-2.5"
        >
          <!-- Глиф бренда из DESIGN.md (§Shapes), а не стоковая иконка: оранжевое
               солнце на тёплом холсте, без подложки-диска. -->
          <BrandSun class="size-9 shrink-0" />
          <span class="text-lg font-bold tracking-tight">Фабрика идей</span>
        </NuxtLink>

        <nav
          aria-label="Основная навигация"
          class="hidden md:block"
        >
          <ul class="flex items-center gap-1 sm:gap-2">
            <li
              v-for="item in navItems"
              :key="item.to"
            >
              <NuxtLink
                :to="item.to"
                class="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                :class="isActive(item.to)
                  ? 'bg-primary-soft text-primary'
                  : 'text-foreground hover:bg-surface'"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                <Icon
                  :name="item.icon"
                  class="size-4"
                />
                {{ item.label }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-[1200px] px-6 pb-24 pt-8 md:px-16 md:pb-8">
      <slot />
    </main>

    <MobileBottomBar />
  </div>
</template>
