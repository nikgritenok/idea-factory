import type { PhaseRole } from '~~/shared/phase-names'

import { isPhaseRole } from '~~/shared/phase-names'

import { extractApiMessage } from './types'

/** Строка `agent_outputs` в том виде, как её отдаёт GET /api/ideas/:id/outputs. */
export interface IdeaOutputRow {
  createdAt: string
  formatValid: boolean
  id: string
  outdated: boolean
  role: string
}

/**
 * Выходы агентов по идее — один запрос на карточку.
 *
 * Кладём в `useState` по id идеи: «Ход работы» и журнал вызовов живут в одной
 * карточке и раньше тянули `/outputs` каждый сам. Плюс этот же список решает,
 * у каких фаз вообще есть что показывать (кнопка «Материалы»), и обновляется
 * во время прогона, чтобы отработанная фаза стала кликабельной без перезагрузки.
 */
export function useIdeaOutputs(source: MaybeRefOrGetter<string>) {
  // `useState` в Nuxt принимает только строковый ключ (ни getter, ни Ref), поэтому
  // ключ фиксируется на инстанс компонента. Переход /ideas/A → /ideas/B не должен
  // оставить старые данные: страница ideas/[id] переключается по key маршрута
  // (definePageMeta), и карточка монтируется заново со своим ключом кэша.
  const ideaId = toValue(source)
  const outputs = useState<IdeaOutputRow[]>(`idea-outputs:${ideaId}`, () => [])
  const error = useState<null | string>(`idea-outputs:${ideaId}:error`, () => null)
  const loading = ref(false)
  const loaded = ref(false)

  async function load(): Promise<void> {
    if (loading.value) {
      return
    }
    loading.value = true
    try {
      const data = await $fetch<{ outputs: IdeaOutputRow[] }>(`/api/ideas/${ideaId}/outputs`)
      outputs.value = data.outputs
      error.value = null
    }
    catch (err) {
      error.value = extractApiMessage(err, 'Не удалось загрузить вызовы агентов')
    }
    finally {
      loading.value = false
      loaded.value = true
    }
  }

  /** Роли, у которых есть актуальный (не устаревший) выход — у них и есть материалы. */
  const rolesWithMaterials = computed<Set<PhaseRole>>(() => {
    const roles = new Set<PhaseRole>()
    for (const row of outputs.value) {
      if (isPhaseRole(row.role)) {
        roles.add(row.role)
      }
    }
    return roles
  })

  function hasMaterials(role: PhaseRole): boolean {
    return rolesWithMaterials.value.has(role)
  }

  /** Когда фаза завершилась (для строки журнала). */
  function finishedAt(role: PhaseRole): string | undefined {
    return outputs.value.find(o => o.role === role)?.createdAt
  }

  return { error, finishedAt, hasMaterials, loaded, loading, load, outputs, rolesWithMaterials }
}
