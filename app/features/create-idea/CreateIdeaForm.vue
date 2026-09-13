<script setup lang="ts">
import type { Priority } from '~~/shared/schemas'
import { motion } from 'motion-v'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { extractApiMessage } from '../ideas/types'
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
    submitError.value = extractApiMessage(err, 'Не удалось сохранить идею')
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-[720px] space-y-8">
    <header class="space-y-2">
      <p class="text-label-sm font-medium tracking-label-sm text-muted-foreground">
        Новая идея
      </p>
      <h1 class="text-headline-lg font-bold leading-[1.2] tracking-headline-lg text-primary">
        Опишите идею текстом или голосом
      </h1>
      <div class="flex items-center gap-1.5">
        <p class="text-body-md text-muted-foreground">
          Текст превратится в карточку, встанет в очередь и запустится исследование.
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                aria-label="Подробнее о том, что происходит с идеей"
                class="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-foreground transition-colors hover:bg-surface-tint"
              >
                <Icon
                  name="lucide:circle-help"
                  class="size-4"
                  aria-hidden="true"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent class="border-primary bg-primary text-primary-foreground">
              <p class="max-w-[52ch]">
                Расскажите, какой процесс хотите автоматизировать или улучшить — система превратит
                текст в карточку идеи, поставит её в очередь и запустит исследование.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>

    <div
      v-if="createdIdeaId"
      class="rounded-xl bg-success-soft p-4 text-sm text-success"
      role="status"
    >
      Идея сохранена. Открываем карточку…
    </div>

    <form
      class="space-y-6 rounded-lg border border-border bg-card p-6"
      @submit.prevent="handleSubmit"
    >
      <div class="space-y-2">
        <label
          for="transcript"
          class="text-label-sm font-medium tracking-label-sm text-muted-foreground"
        >
          Текст идеи
        </label>
        <div class="relative">
          <!-- §Forms & Inputs: белый фон, радиус 8px, body-md 16px (14px в поле даёт
               focus-zoom на iOS), рамка 1px #E2DFD8, фокус — синяя рамка. -->
          <textarea
            id="transcript"
            v-model="transcript"
            rows="3"
            required
            minlength="10"
            :disabled="recording || transcribing"
            :placeholder="recording ? 'Идёт запись…' : 'Например: заявки из формы в CRM'"
            class="max-h-64 w-full resize-none overflow-y-auto rounded-sm border border-border bg-surface-bright px-3 py-3 text-body-md leading-[1.6] [field-sizing:content] pr-24 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground"
          />

          <div class="absolute right-2 top-2 flex items-center gap-1">
            <template v-if="!recording && !transcribing">
              <!-- DESIGN.md:440 — иконная кнопка: фон Warm Surface, иконка Ink.
                   Отдельной submit-иконки в поле нет: primary на экране одна
                   (кнопка «Сохранить идею» внизу формы). -->
              <button
                type="button"
                aria-label="Начать голосовой ввод"
                class="inline-flex size-9 items-center justify-center rounded-full bg-surface text-foreground transition-colors hover:bg-surface-tint"
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
                class="inline-flex size-9 items-center justify-center rounded-full bg-success text-on-primary transition-colors hover:bg-success/90"
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
          class="text-center text-body-sm text-muted-foreground"
          role="status"
        >
          Запись · {{ durationSec }} с
        </p>

        <p
          v-if="transcribing"
          class="text-center text-body-sm text-muted-foreground"
          role="status"
        >
          Расшифровываем…
        </p>

        <p
          v-if="error"
          class="text-body-sm text-destructive"
          role="alert"
        >
          {{ error }}
        </p>

        <p
          v-if="hasText && transcript.trim().length < 10 && !recording"
          class="text-body-sm text-destructive"
          role="alert"
        >
          Опишите идею подробнее — минимум 10 символов.
        </p>

        <p
          v-if="hasText"
          class="text-right text-body-sm text-muted-foreground"
        >
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
            class="text-label-sm font-medium tracking-label-sm text-muted-foreground"
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
              class="relative rounded-full px-4 py-1.5 text-label-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="priority === opt.value
                ? 'font-bold text-primary ring-1 ring-inset ring-primary'
                : 'font-medium text-foreground'"
              @click="priority = opt.value"
            >
              <motion.span
                v-if="priority === opt.value"
                layout-id="priority-pill"
                :transition="{ type: 'spring', stiffness: 420, damping: 34 }"
                class="absolute inset-0 rounded-full bg-primary-soft"
                aria-hidden="true"
              />
              <span class="relative inline-flex items-center gap-1">
                <Icon
                  v-if="priority === opt.value"
                  name="lucide:check"
                  class="size-3.5"
                  aria-hidden="true"
                />
                {{ opt.label }}
              </span>
            </button>
          </div>
        </div>

        <!-- §Buttons: pill, h-48, label-md; §Forms: primary формы — на всю ширину
             колонки. Неактивное состояние — дизайн из токенов, а не opacity-50. -->
        <button
          type="submit"
          :disabled="!canSubmit"
          class="inline-flex h-12 w-full items-center justify-center rounded-full border border-transparent bg-primary px-6 text-label-md font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-bright disabled:text-muted-foreground"
        >
          {{ submitting ? 'Сохраняем…' : 'Сохранить идею' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* §15: амплитуда на transform: scaleY, а не height (layout-сдвиг каждый кадр). */
.audio-bar {
  display: inline-block;
  width: 3px;
  height: 20px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  transform-origin: center;
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
  0%, 100% { transform: scaleY(0.3); }
  50% { transform: scaleY(1); }
}
</style>
