import type { IdeaSummary } from '../ideas/types'
import type { JobSnapshot } from './card-actions'

import { useActionFlash } from './useActionFlash'

/** Сколько секунд карточка ждёт второго касания, чтобы архивировать. */
const ARCHIVE_CONFIRM_MS = 4000

type FlashApi = Pick<ReturnType<typeof useActionFlash>, 'attempt' | 'show'>

interface ActionDeps {
  flash: FlashApi
  onArchived: (idea: IdeaSummary, archived: boolean) => void
  refresh: () => Promise<unknown>
  reloadArchived: () => Promise<void>
  settle: (ideaId: string) => Promise<void>
}

async function patchStage(idea: IdeaSummary, stage: string): Promise<void> {
  await $fetch(`/api/ideas/${idea.id}`, { body: { funnel_stage: stage }, method: 'PATCH' })
}

async function runIdea(deps: ActionDeps, idea: IdeaSummary): Promise<void> {
  const res = await $fetch<{ created: boolean }>(`/api/ideas/${idea.id}/run`, { method: 'POST' })
  await deps.settle(idea.id)
  // Идемпотентный 200 иначе неотличим от 201: без ответа владелец жмёт второй раз.
  deps.flash.show({
    action: null,
    text: res.created ? 'Прогон поставлен в очередь' : 'По этой идее прогон уже в работе',
    tone: res.created ? 'success' : 'info',
  })
}

/** Пауза и продолжение — один вызов к очереди, разные эндпоинт, глагол и текст. */
async function controlJob(
  deps: ActionDeps,
  idea: IdeaSummary,
  job: JobSnapshot,
  verb: 'pause' | 'resume',
): Promise<void> {
  await $fetch(`/api/jobs/${job.id}/${verb}`, { method: 'POST' })
  await deps.settle(idea.id)
  deps.flash.show({
    action: null,
    text: verb === 'pause' ? 'Прогон остановлен на границе шага' : 'Прогон вернулся в очередь',
    tone: 'success',
  })
}

/**
 * Архив в два касания: под лимит 10 идей он жмётся часто и на ходу, а строка после
 * него исчезает с доски. Undo возвращает прежнюю стадию — её мы ещё знаем.
 */
async function archiveIdea(deps: ActionDeps, idea: IdeaSummary): Promise<void> {
  const previousStage = idea.funnelStage
  await patchStage(idea, 'archived')
  deps.onArchived(idea, true)
  await deps.settle(idea.id)
  deps.flash.show({
    action: {
      label: 'Вернуть',
      run: async () => {
        await deps.flash.attempt(async () => {
          await patchStage(idea, previousStage)
          deps.onArchived(idea, false)
          await deps.refresh()
        }, 'Не удалось вернуть идею')
      },
    },
    text: 'Идея в архиве',
    tone: 'success',
  })
}

/** Возврат из «Архива»: предыдущая стадия не сохранилась, честный ответ — «Черновик». */
async function restoreIdea(deps: ActionDeps, idea: IdeaSummary): Promise<void> {
  await patchStage(idea, 'draft')
  deps.onArchived(idea, false)
  await Promise.all([deps.refresh(), deps.reloadArchived()])
  deps.flash.show({ action: null, text: 'Идея вернулась в воронку на стадии «Черновик»', tone: 'success' })
}

async function deleteIdea(deps: ActionDeps, idea: IdeaSummary): Promise<void> {
  await $fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' })
  deps.onArchived(idea, false)
  await Promise.all([deps.refresh(), deps.reloadArchived()])
  deps.flash.show({ action: null, text: 'Идея удалена вместе с историей', tone: 'success' })
}

/**
 * Действия владельца над идеей на доске: запуск, остановка, продолжение, архив
 * (двухшаговый, с отменой), возврат в воронку, удаление.
 */
export function useIdeaActions(options: {
  onArchived: (idea: IdeaSummary, archived: boolean) => void
  refresh: () => Promise<unknown>
  reloadArchived: () => Promise<void>
}) {
  const jobs = ref<Record<string, JobSnapshot | null>>({})
  const busyIdeaId = ref<null | string>(null)
  const confirmingArchiveId = ref<null | string>(null)
  const flash = useActionFlash()

  let confirmTimer: undefined | ReturnType<typeof setTimeout>
  onScopeDispose(() => { clearTimeout(confirmTimer) })

  async function loadJob(ideaId: string): Promise<void> {
    try {
      const data = await $fetch<{ job: JobSnapshot | null }>(`/api/ideas/${ideaId}/latest-job`)
      jobs.value = { ...jobs.value, [ideaId]: data.job ?? null }
    }
    catch {
      // Статус — справочные данные: без них не показываем «идёт анализ», а доску не роняем.
      jobs.value = { ...jobs.value, [ideaId]: null }
    }
  }

  async function settle(ideaId: string): Promise<void> {
    await Promise.all([options.refresh(), loadJob(ideaId)])
  }

  const deps: ActionDeps = {
    flash: { attempt: flash.attempt, show: flash.show },
    onArchived: options.onArchived,
    refresh: options.refresh,
    reloadArchived: options.reloadArchived,
    settle,
  }

  async function withBusy(ideaId: string, fn: () => Promise<void>): Promise<void> {
    busyIdeaId.value = ideaId
    try {
      await fn()
    }
    finally {
      busyIdeaId.value = null
    }
  }

  async function run(idea: IdeaSummary): Promise<void> {
    await withBusy(idea.id, async () => { await flash.attempt(async () => { await runIdea(deps, idea) }, 'Не удалось запустить анализ') })
  }

  async function jobControl(idea: IdeaSummary, verb: 'pause' | 'resume'): Promise<void> {
    const job = jobs.value[idea.id]
    if (!job) {
      await Promise.resolve(); return
    }
    const fallback = verb === 'pause' ? 'Не удалось остановить прогон' : 'Не удалось продолжить прогон'
    await withBusy(idea.id, async () => { await flash.attempt(async () => { await controlJob(deps, idea, job, verb) }, fallback) })
  }

  /** Первое касание — подтверждение, второе — само архивирование. */
  function archive(idea: IdeaSummary): void {
    if (confirmingArchiveId.value !== idea.id) {
      clearTimeout(confirmTimer)
      confirmingArchiveId.value = idea.id
      flash.show({ action: null, text: 'Нажмите ещё раз, чтобы убрать идею в архив', tone: 'info' })
      confirmTimer = setTimeout(() => {
        confirmingArchiveId.value = null
      }, ARCHIVE_CONFIRM_MS)
      return
    }

    clearTimeout(confirmTimer)
    confirmingArchiveId.value = null
    void withBusy(idea.id, async () => { await flash.attempt(async () => { await archiveIdea(deps, idea) }, 'Не удалось архивировать идею') })
  }

  async function restore(idea: IdeaSummary): Promise<void> {
    await withBusy(idea.id, async () => { await flash.attempt(async () => { await restoreIdea(deps, idea) }, 'Не удалось вернуть идею в воронку') })
  }

  async function remove(idea: IdeaSummary): Promise<void> {
    await withBusy(idea.id, async () => { await flash.attempt(async () => { await deleteIdea(deps, idea) }, 'Не удалось удалить идею') })
  }

  return {
    archive,
    busyIdeaId,
    confirmingArchiveId,
    flash: flash.flash,
    jobs,
    loadJob,
    remove,
    restore,
    resume: async (idea: IdeaSummary) => { await jobControl(idea, 'resume') },
    run,
    stop: async (idea: IdeaSummary) => { await jobControl(idea, 'pause') },
  }
}
