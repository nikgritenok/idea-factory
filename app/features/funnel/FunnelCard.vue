<script setup lang="ts">
import type { IdeaSummary } from '../ideas/types'
import type { CardAction, JobSnapshot } from './card-actions'
import { computed } from 'vue'

import { FUNNEL_LABELS, PRIORITY_LABELS } from '../ideas/types'
import { ACTION_LABELS, planCardActions, QUIET_ACTIONS } from './card-actions'

const props = defineProps<{
  busy?: boolean
  /** Демо-режим: действия скрыты, карточка только для чтения. */
  demo?: boolean
  /** Статус прогона ещё не пришёл — показываем только архивирование. */
  jobKnown?: boolean
  /** Карточка ждёт подтверждения архивирования (первое касание уже было). */
  confirmingArchive?: boolean
  idea: IdeaSummary
  job?: JobSnapshot | null
}>()

const emit = defineEmits<{ action: [CardAction] }>()

const plan = computed(() => planCardActions(props.idea.funnelStage, props.job ?? null, props.jobKnown !== false))
const isRunning = computed(() => props.job?.status === 'running' || props.job?.status === 'queued')

const PLATE_TONES = {
  error: 'bg-destructive/10 text-destructive',
  paused: 'bg-muted text-foreground',
  running: 'bg-primary-soft text-primary',
} as const

function stageClasses(stage: string): string {
  if (stage === 'mvp_ready') return 'bg-success-soft text-success'
  if (stage === 'decision') return 'bg-accent/20 text-foreground'
  if (stage === 'archived') return 'bg-muted text-muted-foreground'
  return 'bg-primary-soft text-primary'
}

function priorityClasses(priority: string): string {
  if (priority === 'high') return 'bg-secondary-soft text-foreground'
  if (priority === 'low') return 'bg-muted text-muted-foreground'
  return 'bg-surface-cream text-foreground'
}
</script>

<template>
  <li
    class="rounded-2xl border bg-card p-5"
    :aria-busy="isRunning || undefined"
  >
    <!-- Вертикальный стек: ряд «текст + кнопки» схлопывал колонку заголовка до 10px
         на 360px (flex-1 с базисом 0% против shrink-0 кнопок). -->
    <div class="space-y-3">
      <div class="min-w-0 space-y-2">
        <NuxtLink
          :to="`/ideas/${idea.id}`"
          class="text-lg font-bold leading-snug text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {{ idea.title }}
        </NuxtLink>

        <p
          v-if="idea.problem"
          class="line-clamp-2 text-sm leading-6 text-muted-foreground"
        >
          {{ idea.problem }}
        </p>

        <div class="flex flex-wrap items-center gap-1.5">
          <span
            class="rounded-full px-2.5 py-0.5 text-[13px] font-medium"
            :class="stageClasses(idea.funnelStage)"
          >
            <span class="sr-only">Этап воронки: </span>
            {{ FUNNEL_LABELS[idea.funnelStage] ?? idea.funnelStage }}
          </span>
          <span
            class="rounded-full px-2.5 py-0.5 text-[13px] font-medium"
            :class="priorityClasses(idea.priority)"
          >
            <span class="sr-only">Приоритет: </span>
            {{ PRIORITY_LABELS[idea.priority] ?? idea.priority }}
          </span>
          <span class="text-label-sm text-muted-foreground">
            <span class="sr-only">Версия </span>v{{ idea.version }}
          </span>
        </div>
      </div>

      <!-- Статус прогона — плашка, а не кнопка: действие над идеей уже идёт. -->
      <p
        v-if="plan.plate"
        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label-sm font-medium"
        :class="PLATE_TONES[plan.plate.tone]"
      >
        <Icon
          :name="plan.plate.icon"
          class="size-3.5"
          :class="plan.plate.spinning ? 'animate-spin' : ''"
          aria-hidden="true"
        />
        {{ plan.plate.text }}
      </p>

      <div
        v-if="!demo"
        class="flex gap-2 border-t border-border pt-3"
      >
        <button
          v-for="action in plan.actions"
          :key="action"
          type="button"
          :disabled="busy"
          class="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-label-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          :class="[
            action === 'run' || action === 'resume' ? 'flex-[1.7]' : 'flex-1',
            QUIET_ACTIONS.has(action)
              ? 'border bg-background text-foreground hover:bg-surface'
              : 'bg-secondary text-foreground hover:opacity-90',
            action === 'archive' && confirmingArchive
              ? 'border-destructive bg-destructive/10 text-destructive'
              : '',
            action === 'delete' ? 'border-destructive/40 text-destructive hover:bg-destructive/10' : '',
          ]"
          @click="emit('action', action)"
        >
          <Icon
            v-if="busy"
            name="lucide:loader-2"
            class="size-4 animate-spin"
            aria-hidden="true"
          />
          {{ action === 'archive' && confirmingArchive ? 'Подтвердить архив' : ACTION_LABELS[action] }}
        </button>
      </div>
    </div>
  </li>
</template>
