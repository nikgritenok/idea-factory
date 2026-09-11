<script setup lang="ts">
import type { Priority } from '~~/shared/schemas'
import { useVoiceInput } from '../voice-input/useVoiceInput'

const transcript = ref('')
const priority = ref<Priority>('medium')
const submitting = ref(false)
const submitError = ref<null | string>(null)
const createdIdeaId = ref<null | string>(null)

const {
  cancel, durationSec, error, recording, start, stop, transcribe, transcribing,
} = useVoiceInput()

const PRIORITY_OPTIONS: Array<{ value: Priority, label: string }> = [
  { label: 'Высокий', value: 'high' },
  { label: 'Средний', value: 'medium' },
  { label: 'Низкий', value: 'low' },
]

const hasText = computed(() => transcript.value.trim().length > 0)
const canSubmit = computed(() => transcript.value.trim().length >= 10 && !submitting.value)

async function handleMic(): Promise<void> {
  if (recording.value) return
  await start()
}

async function handleConfirm(): Promise<void> {
  await stop()
  const text = await transcribe()
  if (text) {
    transcript.value = transcript.value ? `${transcript.value}\n${text}` : text
  }
}

function handleCancel(): void {
  cancel()
}

async function handleSubmit(): Promise<void> {
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
      @submit.prevent="handleSubmit"
    >
      <div class="space-y-2">
        <div class="relative">
          <textarea
            id="transcript"
            v-model="transcript"
            rows="6"
            required
            minlength="10"
            :disabled="recording || transcribing"
            :placeholder="recording ? 'Идёт запись…' : 'Опишите идею…'"
            class="w-full resize-none rounded-xl border bg-background px-4 py-3 pr-24 text-sm leading-6 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div class="absolute right-2 top-2 flex items-center gap-1">
            <template v-if="!recording && !transcribing">
              <button
                v-if="hasText"
                type="submit"
                :disabled="!canSubmit"
                aria-label="Отправить идею"
                class="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon name="lucide:send" class="size-4" />
              </button>
              <button
                type="button"
                aria-label="Начать голосовой ввод"
                class="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:opacity-90"
                @click="handleMic"
              >
                <Icon name="lucide:mic" class="size-4" />
              </button>
            </template>

            <template v-else-if="recording">
              <button
                type="button"
                aria-label="Отменить запись"
                class="inline-flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                @click="handleCancel"
              >
                <Icon name="lucide:x" class="size-4" />
              </button>
              <button
                type="button"
                aria-label="Остановить запись и расшифровать"
                class="inline-flex size-9 items-center justify-center rounded-full bg-success text-white transition-colors hover:bg-success/90"
                @click="handleConfirm"
              >
                <Icon name="lucide:check" class="size-4" />
              </button>
            </template>

            <template v-else-if="transcribing">
              <span class="inline-flex size-9 items-center justify-center">
                <Icon name="lucide:loader-2" class="size-4 animate-spin text-primary" />
              </span>
            </template>
          </div>
        </div>

        <div
          v-if="recording"
          class="flex items-center justify-center gap-1 py-2"
          aria-hidden="true"
        >
          <span class="audio-bar" />
          <span class="audio-bar" />
          <span class="audio-bar" />
          <span class="audio-bar" />
          <span class="audio-bar" />
          <span class="audio-bar" />
          <span class="audio-bar" />
        </div>

        <p
          v-if="recording"
          class="text-center text-xs text-muted-foreground"
          role="status"
        >
          Запись · {{ durationSec }} с
        </p>

        <p
          v-if="transcribing"
          class="text-center text-xs text-muted-foreground"
          role="status"
        >
          Расшифровываем…
        </p>

        <p
          v-if="error"
          class="text-sm text-destructive"
          role="alert"
        >
          {{ error }}
        </p>

        <p
          v-if="hasText && transcript.trim().length < 10 && !recording"
          class="text-sm text-destructive"
          role="alert"
        >
          Опишите идею подробнее — минимум 10 символов.
        </p>

        <p class="text-right text-xs text-muted-foreground">
          {{ transcript.trim().length }} символов
        </p>
      </div>

      <p
        v-if="submitError"
        class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        role="alert"
      >
        {{ submitError }}
      </p>

      <div class="space-y-4">
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

        <button
          type="submit"
          :disabled="!canSubmit"
          class="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
        >
          {{ submitting ? 'Сохраняем…' : 'Сохранить идею' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.audio-bar {
  display: inline-block;
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background-color: var(--color-primary);
  animation: audio-wave 0.8s ease-in-out infinite;
}

.audio-bar:nth-child(1) { animation-delay: 0s; }
.audio-bar:nth-child(2) { animation-delay: 0.1s; }
.audio-bar:nth-child(3) { animation-delay: 0.2s; }
.audio-bar:nth-child(4) { animation-delay: 0.3s; }
.audio-bar:nth-child(5) { animation-delay: 0.2s; }
.audio-bar:nth-child(6) { animation-delay: 0.1s; }
.audio-bar:nth-child(7) { animation-delay: 0s; }

@keyframes audio-wave {
  0%, 100% { height: 6px; }
  50% { height: 20px; }
}
</style>
