<script setup lang="ts">
/**
 * Материалы фазы: MD-документ с тем, что фаза реально выдала по вашей идее.
 *
 * Это ответ на главный провал прошлой версии — проверяющий не увидел результатов
 * работы агентов. Здесь важно три вещи:
 *  1) контент рендерится блоками из API (`shared/material-blocks`), без `v-html`:
 *     тексты приходят из модели, и подстановка их в HTML = XSS-поверхность;
 *  2) «Скачать .md» отдаёт ровно тот же текст, что на экране (Blob, без сервера);
 *  3) состояние загрузки/ошибки не молчит: у нас теперь каждый отказ отвечает
 *     `code` + `why` + `fix`, и владельцу показываем человеческую часть.
 */
import type { PhaseMaterials } from '~~/shared/material-blocks'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

import { phaseTitle } from '~~/shared/phase-names'
import { extractApiMessage } from './types'

const props = defineProps<{
  ideaId: string
  role: string
}>()

type RenderNode
  = | { level: 1 | 2 | 3, text: string, type: 'h' }
    | { items: string[], type: 'ul' }
    | { text: string, type: 'p' }
    | { text: string, type: 'pre' }

const open = ref(false)
const loading = ref(false)
const error = ref<null | string>(null)
const doc = ref<null | PhaseMaterials>(null)

/** Загрузка ленивая: материал нужен, когда его открыли, а не на каждый рендер карточки. */
async function load(): Promise<void> {
  if (doc.value || loading.value) {
    return
  }
  loading.value = true
  error.value = null
  try {
    doc.value = await $fetch<PhaseMaterials>(`/api/ideas/${props.ideaId}/phases/${props.role}/materials`)
  }
  catch (err: unknown) {
    error.value = extractApiMessage(err, 'Не удалось открыть материалы фазы')
  }
  finally {
    loading.value = false
  }
}

function toggle(): void {
  open.value = !open.value
  if (open.value) {
    void load()
  }
}

/**
 * Группируем подряд идущие `li` в один список. Заголовок уровня 1 не рендерим:
 * он дублирует заголовок диалога (в скачанном .md остаётся).
 */
const nodes = computed<RenderNode[]>(() => {
  const out: RenderNode[] = []
  for (const block of doc.value?.blocks ?? []) {
    if (block.type === 'h' && block.level === 1) {
      continue
    }
    if (block.type === 'li') {
      const last = out.at(-1)
      if (last?.type === 'ul') {
        last.items.push(block.text)
        continue
      }
      out.push({ items: [block.text], type: 'ul' })
      continue
    }
    out.push(block as RenderNode)
  }
  return out
})

const title = computed(() => doc.value?.phase.title ?? phaseTitle(props.role, 'Материалы фазы'))

async function download(): Promise<void> {
  const markdown = doc.value?.markdown
  if (!markdown) {
    return
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `materials-${props.role}-${stamp}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <Dialog v-model:open="open">
    <button
      type="button"
      class="inline-flex h-11 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="`Материалы фазы: ${title}`"
      @click="toggle"
    >
      Материалы
    </button>
    <DialogContent class="max-h-[86vh] gap-0 overflow-hidden p-0 sm:max-w-[720px]">
      <DialogHeader class="border-b bg-card px-5 py-4">
        <DialogTitle class="text-lg font-bold">
          {{ title }}
        </DialogTitle>
        <DialogDescription class="text-sm text-muted-foreground">
          Что фаза вернула по вашей идее — текст материала без изменений
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[60vh] overflow-y-auto px-5 py-4">
        <p
          v-if="loading"
          class="text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          Загружаю материалы…
        </p>

        <div
          v-else-if="error"
          class="space-y-3"
        >
          <p
            class="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {{ error }}
          </p>
          <button
            type="button"
            class="inline-flex h-11 items-center rounded-full border bg-background px-4 text-sm font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            @click="load"
          >
            Повторить
          </button>
        </div>

        <article
          v-else-if="doc"
          class="space-y-3 text-sm leading-6"
        >
          <template v-for="(node, i) in nodes" :key="i">
            <h3
              v-if="node.type === 'h' && node.level === 2"
              class="pt-2 text-base font-bold"
            >
              {{ node.text }}
            </h3>
            <h4
              v-else-if="node.type === 'h'"
              class="pt-1 font-semibold"
            >
              {{ node.text }}
            </h4>
            <p
              v-else-if="node.type === 'p'"
              class="text-foreground/90"
            >
              {{ node.text }}
            </p>
            <ul
              v-else-if="node.type === 'ul'"
              class="ml-4 list-disc space-y-1 marker:text-muted-foreground"
            >
              <li
                v-for="(item, j) in node.items"
                :key="j"
              >
                {{ item }}
              </li>
            </ul>
            <pre
              v-else
              class="overflow-x-auto rounded-lg bg-surface p-3 text-xs leading-5"
            >{{ node.text }}</pre>
          </template>
        </article>
      </div>

      <DialogFooter class="border-t bg-card px-5 py-3">
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center rounded-full border bg-background px-5 text-label-md font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
          :disabled="!doc"
          @click="download"
        >
          Скачать .md
        </button>
        <DialogClose as-child>
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-label-md font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Закрыть
          </button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
