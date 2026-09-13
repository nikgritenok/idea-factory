<script setup lang="ts">
import { motion } from 'motion-v'

const route = useRoute()

// Мобильная навигация = те же три пункта, что в шапке (§Navigation).
// «Новая идея» — плюс, а не микрофон: микрофон уже живёт в поле ввода на главном
// экране, дубль путал, где активное действие.
const navItems = [
  { icon: 'lucide:plus', label: 'Новая идея', to: '/' },
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
    aria-label="Мобильная навигация"
    class="fixed inset-x-2 bottom-3 z-30 pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    <div class="mx-auto flex h-14 max-w-[420px] items-stretch gap-0.5 rounded-full border border-border bg-surface-bright/95 px-1.5 shadow-[0_24px_64px_rgba(17,17,17,0.18)] backdrop-blur">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :aria-current="isActive(item.to) ? 'page' : undefined"
        class="relative flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-0.5 transition-colors"
        :class="isActive(item.to) ? 'font-medium text-primary' : 'text-muted-foreground'"
      >
        <!-- §15 shared: пилюля переезжает между пунктами через layoutId (transform,
             не left/width). Выделение читается и без цвета: подложка + жирность. -->
        <motion.span
          v-if="isActive(item.to)"
          layout-id="mobile-nav-pill"
          :transition="{ type: 'spring', stiffness: 420, damping: 34 }"
          class="absolute inset-0 rounded-full bg-primary-soft"
          aria-hidden="true"
        />
        <Icon
          :name="item.icon"
          class="relative size-4 shrink-0"
          aria-hidden="true"
        />
        <span class="relative truncate text-label-sm leading-none">
          {{ item.label }}
        </span>
      </NuxtLink>
    </div>
  </nav>
</template>
