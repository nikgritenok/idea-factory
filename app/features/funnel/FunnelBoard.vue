<script setup lang="ts">
import type { IdeaSummary } from '../ideas/types'
import type { CardAction } from './card-actions'

import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

import { FUNNEL_LABELS, FUNNEL_STAGES } from '../ideas/types'
import FunnelCard from './FunnelCard.vue'
import { useIdeaActions } from './useIdeaActions'

const route = useRoute()
const isDemo = computed(() => route.query.demo === '1')

const { error, ideas, pending, refresh } = useIdeas()

const stageFilter = ref<string>('all')
const archivedIdeas = ref<IdeaSummary[]>([])
const archivedLoaded = ref(false)
const loadingArchived = ref(false)
const archivedError = ref<null | string>(null)

const LIMIT = 10

// API уже отсекает архив, когда stage не запрошен: отдельный фильтр здесь был бы
// второй реализацией того же числа и врал бы при расхождении.
const activeCount = computed(() => ideas.value.length)
const archivedCount = computed(() => archivedIdeas.value.length)

const {
  archive,
  busyIdeaId,
  confirmingArchiveId,
  flash,
  jobs,
  loadJob,
  remove,
  restore,
  resume,
  run,
  stop,
} = useIdeaActions({
  onArchived: (idea, archived) => {
    // Счётчик «Архив (N)» намеренно локальный: без этого чип устаревал до следующего
    // открытия вкладки (watch догружал только при пустом списке).
    if (archived) {
      if (!archivedIdeas.value.some(i => i.id === idea.id)) {
        archivedIdeas.value = [...archivedIdeas.value, idea]
      }
    }
    else {
      archivedIdeas.value = archivedIdeas.value.filter(i => i.id !== idea.id)
    }
  },
  refresh,
  reloadArchived: loadArchivedList,
})

const filtered = computed(() => {
  if (stageFilter.value === 'all') return ideas.value
  if (stageFilter.value === 'archived') return archivedIdeas.value
  return ideas.value.filter(i => i.funnelStage === stageFilter.value)
})

const stageCounts = computed(() => {
  const counts: Record<string, number> = { all: ideas.value.length, archived: archivedCount.value }
  for (const idea of ideas.value) {
    counts[idea.funnelStage] = (counts[idea.funnelStage] ?? 0) + 1
  }
  return counts
})

/**
 * Пустые этапы не плодят ряды: полоса прокручивается, непустые — всегда видны.
 * 'archived' исключён: у него отдельный чип со своим счётчиком (список грузится
 * отдельно), иначе он рендерился дважды.
 */
const visibleStages = computed(() =>
  FUNNEL_STAGES.filter(s => s !== 'archived' && (stageCounts.value[s] ?? 0) > 0),
)

async function loadArchivedList(): Promise<void> {
  loadingArchived.value = true
  archivedError.value = null
  try {
    const data = await $fetch<{ ideas: IdeaSummary[] }>('/api/ideas', { query: { stage: 'archived' } })
    archivedIdeas.value = data.ideas
    archivedLoaded.value = true
  }
  catch {
    // Упавший запрос не должен выглядеть как «в архиве пусто» — это читается как потеря данных.
    archivedError.value = 'Не удалось загрузить архив'
  }
  finally {
    loadingArchived.value = false
  }
}

watch(stageFilter, (v) => {
  // Счётчик уже загружен на монтировании; сюда заходим только если та загрузка упала.
  if (v === 'archived' && !archivedLoaded.value && !loadingArchived.value) {
    void loadArchivedList()
  }
})

// Статус прогона живёт 15 секунд: без обновления доска показывает «идёт анализ»
// по снимку момента загрузки и выглядит зависшей.
const JOB_POLL_MS = 15_000
let pollTimer: undefined | ReturnType<typeof setInterval>

async function refreshAllJobs(): Promise<void> {
  await Promise.all(ideas.value.map(async (i) => { await loadJob(i.id) }))
}

onMounted(() => {
  // Чип «Архив» показывается только при непустом счётчике, поэтому архив надо загрузить
  // сразу: иначе доска, где все идеи убраны, не даёт в них попасть (курица и яйцо).
  void loadArchivedList()
  void refreshAllJobs()
  pollTimer = setInterval(() => void refreshAllJobs(), JOB_POLL_MS)
})
onScopeDispose(() => { clearInterval(pollTimer) })

const filterRefs = ref<(null | HTMLElement)[]>([])

/**
 * Колбэк :ref не аннотируем в шаблоне: `el as HTMLElement | null` парсится
 * компилятором Vue как фильтр (символ `|`), а не как тип.
 */
function setFilterRef(index: number): (el: unknown) => void {
  return (el) => {
    filterRefs.value[index] = el instanceof HTMLElement ? el : null
  }
}

function moveFilterFocus(from: number, delta: number): void {
  const count = filterRefs.value.filter(Boolean).length
  if (count === 0) return
  const next = (from + delta + count) % count
  filterRefs.value[next]?.focus()
}

function onFilterKeydown(event: KeyboardEvent, index: number): void {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    moveFilterFocus(index, 1)
  }
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveFilterFocus(index, -1)
  }
}

const deleteTarget = ref<null | IdeaSummary>(null)
const deleteOpen = ref(false)

function askDelete(idea: IdeaSummary): void {
  deleteTarget.value = idea
  deleteOpen.value = true
}

function confirmDelete(): void {
  const idea = deleteTarget.value
  deleteOpen.value = false
  deleteTarget.value = null
  if (idea) void remove(idea)
}

function onCardAction(idea: IdeaSummary, action: CardAction): void {
  if (action === 'run') void run(idea)
  else if (action === 'stop') void stop(idea)
  else if (action === 'resume') void resume(idea)
  else if (action === 'archive') archive(idea)
  else if (action === 'restore') void restore(idea)
  else if (action === 'delete') askDelete(idea)
}

const emptyText = computed(() =>
  stageFilter.value === 'all'
    ? 'Идей пока нет. Создайте первую — опишите её текстом или продиктуйте.'
    : 'В этом этапе воронки идей нет.',
)
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-headline-lg font-bold leading-tight tracking-[-0.01em] text-primary">
          Список идей
          <span class="text-body-md font-medium text-muted-foreground">
            · {{ activeCount }} из {{ LIMIT }}
          </span>
        </h1>
      </div>
      <NuxtLink
        to="/"
        class="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-label-md font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        + Новая идея
      </NuxtLink>
    </header>

    <p
      v-if="activeCount >= LIMIT"
      class="rounded-xl bg-accent/20 p-4 text-body-sm"
      role="status"
    >
      Достигнут лимит {{ LIMIT }} активных идей — новые можно добавлять после архивирования.
    </p>

    <div
      role="radiogroup"
      aria-label="Фильтр по этапу воронки"
      class="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      <button
        :ref="setFilterRef(0)"
        type="button"
        role="radio"
        :aria-checked="stageFilter === 'all'"
        :tabindex="stageFilter === 'all' ? 0 : -1"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 py-2 text-label-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="stageFilter === 'all' ? 'bg-primary-soft font-bold text-primary' : 'bg-surface text-foreground'"
        @click="stageFilter = 'all'"
        @keydown="onFilterKeydown($event, 0)"
      >
        Все ({{ stageCounts.all ?? 0 }})
      </button>
      <button
        v-for="(stage, i) in visibleStages"
        :key="stage"
        :ref="setFilterRef(i + 1)"
        type="button"
        role="radio"
        :aria-checked="stageFilter === stage"
        :tabindex="stageFilter === stage ? 0 : -1"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 py-2 text-label-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="stageFilter === stage ? 'bg-primary-soft font-bold text-primary' : 'bg-surface text-foreground'"
        @click="stageFilter = stage"
        @keydown="onFilterKeydown($event, i + 1)"
      >
        {{ FUNNEL_LABELS[stage] }} ({{ stageCounts[stage] ?? 0 }})
      </button>
      <button
        v-if="stageCounts.archived"
        :ref="setFilterRef(visibleStages.length + 1)"
        type="button"
        role="radio"
        :aria-checked="stageFilter === 'archived'"
        :tabindex="stageFilter === 'archived' ? 0 : -1"
        class="inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 py-2 text-label-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="stageFilter === 'archived' ? 'bg-primary-soft font-bold text-primary' : 'bg-surface text-foreground'"
        @click="stageFilter = 'archived'"
        @keydown="onFilterKeydown($event, visibleStages.length + 1)"
      >
        Архив ({{ archivedCount }})
      </button>
    </div>

    <div
      v-if="pending"
      class="space-y-3"
      role="status"
      aria-label="Загрузка идей"
    >
      <div
        v-for="i in 3"
        :key="i"
        class="h-40 animate-pulse rounded-2xl bg-surface"
      />
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border bg-card p-6 text-center"
      role="alert"
    >
      <p class="text-body-sm text-destructive">
        Не удалось загрузить идеи
      </p>
      <button
        type="button"
        class="mt-3 text-body-sm font-medium text-primary underline"
        @click="refresh()"
      >
        Повторить
      </button>
    </div>

    <div
      v-else-if="stageFilter === 'archived' && archivedError"
      class="rounded-xl border bg-card p-6 text-center"
      role="alert"
    >
      <p class="text-body-sm text-destructive">
        {{ archivedError }}
      </p>
      <button
        type="button"
        class="mt-3 text-body-sm font-medium text-primary underline"
        @click="loadArchivedList()"
      >
        Повторить
      </button>
    </div>

    <p
      v-else-if="filtered.length === 0"
      class="rounded-xl bg-surface p-10 text-center text-body-sm text-muted-foreground"
      role="status"
    >
      {{ emptyText }}
    </p>

    <ul
      v-else
      class="space-y-3"
      aria-label="Список идей"
    >
      <FunnelCard
        v-for="idea in filtered"
        :key="idea.id"
        :idea="idea"
        :job="jobs[idea.id] ?? null"
        :job-known="jobs[idea.id] !== undefined"
        :busy="busyIdeaId === idea.id"
        :demo="isDemo"
        :confirming-archive="confirmingArchiveId === idea.id"
        @action="(a: CardAction) => onCardAction(idea, a)"
      />
    </ul>

    <!-- Ошибки и подтверждения — поверх экрана: над списком они уезжали за границу
         вьюпорта ровно тогда, когда их и нужно увидеть. -->
    <div
      v-if="flash"
      class="fixed inset-x-4 bottom-24 z-40 flex items-center justify-between gap-3 rounded-xl px-4 py-3 shadow-[0_24px_64px_rgba(17,17,17,0.18)]"
      :class="flash.tone === 'error' ? 'bg-destructive text-on-primary' : 'bg-foreground text-background'"
      :role="flash.tone === 'error' ? 'alert' : 'status'"
    >
      <span class="text-body-sm">{{ flash.text }}</span>
      <button
        v-if="flash.action"
        type="button"
        class="shrink-0 text-label-sm font-bold underline"
        @click="flash.action.run()"
      >
        {{ flash.action.label }}
      </button>
    </div>

    <Dialog v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Удалить идею?</DialogTitle>
          <DialogDescription>
            Удаление стирает идею вместе с историей версий, прогонами, отчётами и аудио —
            восстановить нельзя. Если нужно просто убрать её с доски, используйте архив.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-full border bg-background px-5 text-label-md font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            @click="deleteTarget = null"
          >
            Отмена
          </button>
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-full bg-destructive px-5 text-label-md font-medium text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            @click="confirmDelete"
          >
            Удалить навсегда
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
