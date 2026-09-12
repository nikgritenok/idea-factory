<script setup lang="ts">
// Фирменный глиф «солнечный человек» из DESIGN.md (§Shapes): фигура из скруглённых
// лучей, Orange #FFB922 на светлом. Цвет — токеном через currentColor, поэтому
// носитель задаёт его классом (text-tertiary / text-surface-cream на чёрном).
// Рука в компоненте одна: и в шапке, и в мобильной навигации, и в сайдбаре (§Navigation).
import type { HTMLAttributes } from 'vue'

import { cn } from '~/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="cn('size-9 text-tertiary', props.class)"
    aria-hidden="true"
  >
    <circle
      cx="20"
      cy="20"
      r="6"
      fill="currentColor"
    />
    <g fill="currentColor">
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
</template>
