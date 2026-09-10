<script setup lang="ts">
import type { Priority } from '~~/shared/schemas'

const transcript = ref('')
const priority = ref<Priority>('medium')
const submitting = ref(false)
const submitError = ref<null | string>(null)
const createdIdeaId = ref<null | string>(null)

const PRIORITY_OPTIONS: Array<{ value: Priority, label: string }> = [
  { label: 'Высокий', value: 'high' },
  { label: 'Средний', value: 'medium' },
  { label: 'Низкий', value: 'low' },
]

const canSubmit = computed(() => transcript.value.trim().length >= 10 && !submitting.value)

function onTranscribed(text: string): void {
  transcript.value = transcript.value ? `${transcript.value}\n${text}` : text
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  submitting.value = true
  submitError.value = null
  try {
    const res = await $fetch<{ idea: { id: string } }>('/api/ideas', {
      body: { priority: priority.value, source_kind: 'text', transcript: transcript.value.trim() },
      method: 'POST',
    })
    createdIdeaId.value = res.idea.id
    await navigateTo(`/ideas/${res.idea.id}`)
  }
  catch (err: unknown) {
    const e = err as { data?: { error?: { message?: string } }, message?: string }
    submitError.value = e.data?.error?.message ?? e.message ?? 'Не удалось сохранить идею'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[720px] space-y-8">
    <header class="space-y-2">
      <p class="text-sm font-medium text-muted-foreground">
        Новая идея
      </p>
      <h1 class="text-[32px] font-bold leading-tight tracking-[-0.01em] text-primary">
        Опишите идею текстом или голосом
      </h1>
      <p class="text-sm leading-6 text-muted-foreground">
        Расскажите, какой процесс хотите автоматизировать или улучшить — система превратит текст в карточку
        идеи, поставит её в очередь и запустит исследование.
      </p>
    </header>

    <div
      v-if="createdIdeaId"
      class="rounded-xl bg-success-soft p-4 text-sm text-success"
      role="status"
    >
      Идея сохранена. Открываем карточку…
    </div>

    <form
      class="space-y-6 rounded-2xl border bg-card p-6"
      @submit.prevent="submit"
    >
      <div class="space-y-2">
        <span
          id="priority-label"
          class="text-sm font-medium text-muted-foreground"
        >Приоритет</span>
        <div
          role="radiogroup"
          aria-labelledby="priority-label"
          class="flex w-fit gap-1 rounded-full bg-surface p-1"
        >
          <button
            v-for="opt in PRIORITY_OPTIONS"
            :key="opt.value"
            type="button"
            role="radio"
            :aria-checked="priority === opt.value"
            class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="priority === opt.value ? 'bg-primary-soft text-primary' : 'text-foreground'"
            @click="priority = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <VoiceRecorder @transcribed="onTranscribed" />
      </div>

      <div class="space-y-2">
        <label
          for="transcript"
          class="text-sm font-medium text-muted-foreground"
        >Текст идеи</label>
        <span class="ml-1 text-sm font-normal text-muted-foreground">{{ transcript.trim().length }} символов</span>
        <textarea
          id="transcript"
          v-model="transcript"
          rows="8"
          required
          minlength="10"
          placeholder="Например: входящие обращения клиентов разбирает оператор вручную — 6 минут на обращение, 12% уходят не в тот отдел. Хочу, чтобы ИИ классифицировал обращения автоматически, а оператор только проверял."
          class="w-full rounded-lg border bg-background px-3 py-2.5 text-sm leading-6 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p
          v-if="transcript.trim().length > 0 && transcript.trim().length < 10"
          class="text-sm text-destructive"
          role="alert"
        >
          Опишите идею подробнее — минимум 10 символов.
        </p>
      </div>

      <p
        v-if="submitError"
        class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        role="alert"
      >
        {{ submitError }}
      </p>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
      >
        {{ submitting ? 'Сохраняем…' : 'Сохранить идею' }}
      </button>
    </form>
  </div>
</template>
