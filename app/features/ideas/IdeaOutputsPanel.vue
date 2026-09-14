<script setup lang="ts">
/**
 * Журнал вызовов агентов (TZ §4 — проверка обоснованности решений).
 * Панель техническая: формат ответа, устаревшие строки, роль-id. С 2026-09-14 она
 * показывается только в «режиме разработчика» (useDevMode), а владелец видит
 * «Ход работы» с материалами фаз.
 *
 * Данные берёт из useIdeaOutputs: тот же список нужен «Ходу работы», и twice
 * одинаковых запроса на карточку быть не должно.
 */
import { phaseTitle } from '~~/shared/phase-names'
import { useIdeaOutputs } from './useIdeaOutputs'

const props = defineProps<{ ideaId: string }>()

const { error, loaded, load, outputs } = useIdeaOutputs(() => props.ideaId)
const open = ref(false)

// Загружает сам, только если «Ход работы» ещё не потянул список: общий кэш по id идеи.
onMounted(() => {
  if (!loaded.value) {
    void load()
  }
})

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
            <span class="font-medium">{{ phaseTitle(out.role) }} · {{ out.role }}</span>
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
