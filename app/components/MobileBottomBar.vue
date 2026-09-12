<script setup lang="ts">
const route = useRoute()

// Мобильная навигация = те же три пункта, что в шапке (§Navigation).
// Раньше здесь был дубль: центральная «солнечная» плашка вела на /, как и первая
// вкладка, а «Настроек» на мобильном не было вовсе. Глиф бренда живёт в шапке
// (BrandSun), в навигации он не третий пункт назначения.
const navItems = [
  { icon: 'lucide:mic', label: 'Новая идея', to: '/' },
  { icon: 'lucide:list', label: 'Список идей', to: '/ideas' },
  { icon: 'lucide:settings', label: 'Настройки', to: '/settings' },
] as const

function isActive(to: string): boolean {
  if (to === '/ideas') {
    return route.path === '/ideas' || /^\/ideas\/[a-f0-9-]+$/.test(route.path)
  }
  return route.path === to
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
    aria-label="Мобильная навигация"
  >
    <div class="flex items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-1 flex-col items-center gap-1 py-3 transition-colors"
        :class="isActive(item.to) ? 'text-primary' : 'text-muted-foreground'"
        :aria-current="isActive(item.to) ? 'page' : undefined"
      >
        <span
          class="flex size-10 items-center justify-center rounded-full transition-transform active:scale-95"
          :class="isActive(item.to)
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-surface text-foreground'"
          aria-hidden="true"
        >
          <Icon
            :name="item.icon"
            class="size-5"
          />
        </span>
        <span class="text-label-sm font-medium leading-none">
          {{ item.label }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
