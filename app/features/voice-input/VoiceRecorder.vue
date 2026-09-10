<script setup lang="ts">
import { useVoiceInput } from './useVoiceInput'

const emit = defineEmits<{ transcribed: [text: string] }>()

const {
  durationSec, error, recording, start, stop, transcribe, transcribing,
} = useVoiceInput()

async function toggle(): Promise<void> {
  if (recording.value) {
    await stop()
    const text = await transcribe()
    if (text) emit('transcribed', text)
  }
  else {
    await start()
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="recording
          ? 'bg-destructive text-white hover:bg-destructive/90'
          : 'bg-secondary text-[#111111] hover:opacity-90'"
        :aria-pressed="recording"
        :aria-label="recording ? 'Остановить запись и расшифровать' : 'Начать голосовой ввод'"
        @click="toggle"
      >
        <Icon
          :name="recording ? 'lucide:mic-off' : 'lucide:mic'"
          class="size-4"
        />
        {{ recording ? `Идёт запись · ${durationSec} с — остановить` : 'Продиктовать идею' }}
      </button>
      <span
        v-if="transcribing"
        class="text-sm text-muted-foreground"
        role="status"
      >
        Расшифровываем…
      </span>
    </div>
    <p
      v-if="error"
      class="text-sm text-destructive"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
