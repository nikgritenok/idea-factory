<script setup lang="ts">
const route = useRoute()

function isActive(path: string): boolean {
  if (path === '/ideas') {
    return route.path === '/ideas' || /^\/ideas\/[a-f0-9-]+$/.test(route.path)
  }
  if (path === '/') {
    return route.path === '/'
  }
  return route.path === path
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:hidden"
    aria-label="Мобильная навигация"
  >
    <div class="flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
      <NuxtLink
        to="/"
        class="flex flex-1 flex-col items-center gap-1 py-3 text-foreground transition-colors"
        :class="isActive('/') ? 'text-primary' : 'text-muted-foreground'"
        :aria-current="isActive('/') ? 'page' : undefined"
      >
        <span
          class="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          aria-hidden="true"
        >
          <Icon
            name="lucide:mic"
            class="size-5"
          />
        </span>
        <span class="text-[11px] font-medium leading-none">Новая идея</span>
      </NuxtLink>

      <NuxtLink
        to="/"
        class="flex flex-1 flex-col items-center justify-center"
        aria-label="Фабрика идей — главная"
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="size-10"
          aria-hidden="true"
        >
          <circle
            cx="20"
            cy="20"
            r="6"
            fill="#FFB922"
          />
          <g fill="#FFB922">
            <rect
              x="18"
              y="1"
              width="4"
              height="9"
              rx="2"
            />
            <rect
              x="18"
              y="30"
              width="4"
              height="9"
              rx="2"
            />
            <rect
              x="1"
              y="18"
              width="9"
              height="4"
              rx="2"
            />
            <rect
              x="30"
              y="18"
              width="9"
              height="4"
              rx="2"
            />
            <rect
              x="5.5"
              y="5.5"
              width="4"
              height="9"
              rx="2"
              transform="rotate(-45 7.5 10)"
            />
            <rect
              x="30.5"
              y="25.5"
              width="4"
              height="9"
              rx="2"
              transform="rotate(-45 32.5 30)"
            />
            <rect
              x="25.5"
              y="5.5"
              width="4"
              height="9"
              rx="2"
              transform="rotate(45 27.5 10)"
            />
            <rect
              x="5.5"
              y="25.5"
              width="4"
              height="9"
              rx="2"
              transform="rotate(45 7.5 30)"
            />
          </g>
        </svg>
      </NuxtLink>

      <NuxtLink
        to="/ideas"
        class="flex flex-1 flex-col items-center gap-1 py-3 text-foreground transition-colors"
        :class="isActive('/ideas') ? 'text-primary' : 'text-muted-foreground'"
        :aria-current="isActive('/ideas') ? 'page' : undefined"
      >
        <span
          class="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-transform active:scale-95"
          aria-hidden="true"
        >
          <Icon
            name="lucide:list"
            class="size-5"
          />
        </span>
        <span class="text-[11px] font-medium leading-none">Список идей</span>
      </NuxtLink>
    </div>
  </nav>
</template>
