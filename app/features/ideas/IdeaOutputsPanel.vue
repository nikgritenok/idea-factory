<script setup lang="ts">
/**
 * Журнал вызовов ИИ-агентов по идее (TZ §4 — проверка обоснованности решений).
 * Вынесен из IdeaCard: своя загрузка, своё раскрытие, и держал карточку выше лимита max-lines.
 */
import { extractApiMessage } from './types'

interface AgentOutput {
  createdAt: string
  formatValid: boolean
  id: string
  outdated: boolean
  role: string
}

const props = defineProps<{ ideaId: string }>()

const ROLE_LABELS: Record<string, string> = {
  critic: 'Критик',
  efficiency_analyst: 'Аналитик эффективности',
  idea_analyst: 'Аналитик идеи',
  market_analyst: 'Аналитик рынка',
  orchestrator: 'Оркестратор',
  report_editor: 'Редактор отчёта',
  strategist: 'Стратег',
}

const outputs = ref<AgentOutput[]>([])
const open = ref(false)
const error = ref<null | string>(null)

async function load(): Promise<void> {
  error.value = null
  try {
    const data = await $fetch<{ outputs: AgentOutput[] }>(`/api/ideas/${props.ideaId}/outputs`)
    outputs.value = data.outputs
  }
  catch (err: unknown) {
    error.value = extractApiMessage(err, 'Не удалось загрузить вызовы агентов')
  }
}

await load()

const shown = computed(() => outputs.value.length > 0)
</script>

<template>
  <section
    v-if="shown || error"
    class="space-y-3 rounded-2xl border bg-card p-6"
  >
    <p
      v-if="error"
      class="text-sm text-destructive"
      role="alert"
    >
      {{ error }}
    </p>
    <template v-else>
      <button
        type="button"
        class="flex w-full items-center justify-between text-left text-sm font-bold"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span>Вызовы ИИ-агентов ({{ outputs.length }})</span>
        <Icon
          :name="open ? 'lucide:chevron-up' : 'lucide:chevron-down'"
          class="size-4 text-muted-foreground"
        />
      </button>
      <ul
        v-if="open"
        class="space-y-2"
      >
        <li
          v-for="out in outputs"
          :key="out.id"
          class="rounded-xl bg-surface p-3 text-xs"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ ROLE_LABELS[out.role] ?? out.role }}</span>
            <span
              class="rounded-full px-2 py-0.5"
              :class="out.formatValid ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive'"
            >
              {{ out.formatValid ? 'OK' : 'ошибка формата' }}
            </span>
            <span
              v-if="out.outdated"
              class="rounded-full bg-accent/20 px-2 py-0.5"
            >устарел</span>
          </div>
          <p class="mt-1 text-muted-foreground">
            {{ new Date(out.createdAt).toLocaleString('ru-RU', { timeStyle: 'short', dateStyle: 'short' }) }}
          </p>
        </li>
      </ul>
    </template>
  </section>
</template>
