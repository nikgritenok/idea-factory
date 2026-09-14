<script setup lang="ts">
import IdeaCard from '~~/app/features/ideas/IdeaCard.vue'

// Ключ страницы — id идеи: при переходе /ideas/A → /ideas/B компоненты обязаны
// смонтироваться заново, иначе кэш `useState` с ключом, зафиксированным на инстанс,
// покажет данные предыдущей идеи. Вложенные маршруты (report, runs) сохраняют id,
// значит перемонтирования не будет.
definePageMeta({ key: route => String(route.params.id ?? '') })

// На вложенных маршрутах (/report, /runs) карточка показывалась целиком ПЕРЕД
// дочерней страницей: два H1 на экране и одно и то же дважды. Дочерний маршрут —
// это глубина > 1, тогда карточку не рендерим.
const route = useRoute()
const hasChildPage = computed(() => route.matched.length > 1)

useSeoMeta({ title: 'Карточка идеи — Фабрика идей' })
</script>

<template>
  <IdeaCard v-if="!hasChildPage" />
  <NuxtPage />
</template>
