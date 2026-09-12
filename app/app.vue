<script setup lang="ts">
// Единая политика движения для всего приложения.
//
// Дефолт Motion — `reducedMotion: "never"`: без этой обёртки системная настройка
// «Reduce motion» молча игнорируется (a11y-провал, невидимый на скриншоте), а
// визуальная проверка даёт флапающие кадры.
//
// `?motion=off` — режим capture: `always` глушит transform- и layout-анимации.
// Opacity-анимации он НЕ глушит (и `skipAnimations` не поможет: в motion-v 2.4.2
// он доходит только до императивного `useAnimate`, а не до `<motion.*>`), поэтому
// перед скриншотом всё равно ждём успокоения кадра — см. docs/conventions.md §15.
const route = useRoute()
const reducedMotion = computed(() => (route.query.motion === 'off' ? 'always' : 'user'))
</script>

<template>
  <MotionConfig :reduced-motion="reducedMotion">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </MotionConfig>
</template>
