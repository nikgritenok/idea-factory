/** Сколько секунд висит сообщение без действия. */
const FLASH_MS = 6000
/** Окно отмены архивирования — сообщение с кнопкой живёт дольше. */
const UNDO_MS = 8000

export interface Flash {
  action: null | { label: string, run: () => Promise<void> }
  text: string
  tone: 'error' | 'info' | 'success'
}

/**
 * Однострочный ответ доски на действие владельца: ошибка, успех, отмена.
 * Вынесено из useIdeaActions, чтобы у того осталась одна ответственность, и потому,
 * что таймеры обязаны чиститься за областью видимости компонента.
 */
export function useActionFlash() {
  const flash = ref<Flash | null>(null)
  let flashTimer: undefined | ReturnType<typeof setTimeout>

  onScopeDispose(() => { clearTimeout(flashTimer) })

  function show(next: Flash): void {
    clearTimeout(flashTimer)
    flash.value = next
    flashTimer = setTimeout(() => {
      flash.value = null
    }, next.action ? UNDO_MS : FLASH_MS)
  }

  /** Единственная точка, где ошибка действия превращается в сообщение. */
  async function attempt(action: () => Promise<void>, fallback: string): Promise<void> {
    try {
      await action()
    }
    catch (err) {
      // ai-guard требует сужения вместо catch (err: unknown)
      const reason = err instanceof Error ? err.message : ''
      show({ action: null, text: reason || fallback, tone: 'error' })
    }
  }

  return { attempt, flash, show }
}
