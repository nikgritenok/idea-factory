<script setup lang="ts">
import { extractApiMessage } from './types'

/**
 * MVP-панель стадии «Решение» (TZ §1/§10): обращение клиента → классификация LLM
 * → проверка микросервисом-валидатором. Вынесена из IdeaCard: у карточки это был
 * единственный самодостаточный кусок чужой заботы, и он же держал файл выше лимита
 * max-lines.
 */
const props = defineProps<{ ideaId: string }>()

interface MvpResult {
  classification: unknown
  errors: string[]
  validated: boolean
}

const ticketText = ref('')
const busy = ref(false)
const error = ref<null | string>(null)
const result = ref<null | MvpResult>(null)

async function submit(): Promise<void> {
  const text = ticketText.value.trim()
  if (!text) return

  busy.value = true
  error.value = null
  result.value = null
  try {
    result.value = await $fetch<MvpResult>(`/api/ideas/${props.ideaId}/mvp`, {
      body: { ticketText: text },
      method: 'POST',
    })
  }
  catch (err: unknown) {
    error.value = extractApiMessage(err, 'Не удалось проверить обращение')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <section
    class="space-y-4 rounded-2xl border border-secondary bg-secondary/5 p-6"
    aria-labelledby="mvp-heading"
  >
    <h2
      id="mvp-heading"
      class="text-lg font-bold text-secondary"
    >
      MVP: Тест обращения
    </h2>
    <p class="text-sm text-muted-foreground">
      Введите текст обращения клиента — система классифицирует его и проверит правилами.
    </p>

    <form
      class="space-y-3"
      @submit.prevent="submit"
    >
      <textarea
        v-model="ticketText"
        class="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        rows="3"
        placeholder="Здравствуйте, у меня не работает оплата на сайте..."
        aria-label="Текст обращения клиента"
      />
      <button
        type="submit"
        :disabled="busy || !ticketText.trim()"
        class="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-secondary px-5 text-sm font-medium text-on-secondary hover:bg-secondary/90 disabled:opacity-50"
      >
        <Icon
          v-if="busy"
          name="lucide:loader-2"
          class="size-4 animate-spin"
        />
        {{ busy ? 'Обработка...' : 'Проверить обращение' }}
      </button>
    </form>

    <p
      v-if="error"
      class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      {{ error }}
    </p>

    <div
      v-if="result"
      class="space-y-3 rounded-lg border bg-card p-4 text-sm"
      role="status"
    >
      <div class="flex items-center gap-2">
        <Icon
          :name="result.validated ? 'lucide:check-circle-2' : 'lucide:x-circle'"
          :class="result.validated ? 'text-success' : 'text-destructive'"
          class="size-5"
        />
        <span
          :class="result.validated ? 'bg-success-soft text-success' : 'bg-destructive/10 text-destructive'"
          class="rounded-full px-2.5 py-0.5 text-xs font-medium"
        >
          {{ result.validated ? 'Пройдено' : 'Ошибка валидации' }}
        </span>
        <span class="font-medium">Классификация</span>
      </div>

      <dl
        v-if="result.classification"
        class="grid gap-1 sm:grid-cols-[140px_1fr]"
      >
        <div
          v-for="(value, key) in result.classification as Record<string, unknown>"
          :key="key"
          class="contents"
        >
          <dt class="text-muted-foreground">
            {{ key }}
          </dt>
          <dd>{{ typeof value === 'string' ? value : JSON.stringify(value) }}</dd>
        </div>
      </dl>

      <ul
        v-if="result.errors?.length"
        class="list-disc pl-5 text-destructive"
      >
        <li
          v-for="(err, idx) in result.errors"
          :key="idx"
        >
          {{ err }}
        </li>
      </ul>
    </div>
  </section>
</template>
