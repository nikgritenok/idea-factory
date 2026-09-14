/**
 * «Режим разработчика» — один boolean на всё приложение, по умолчанию ВЫКЛ.
 *
 * Владелец должен видеть, что происходит по-человечески; технические окна
 * (JSON-дампы выходов, id шагов, флаги формата, seed'ы) не удаляются из продукта —
 * они уходят под этот переключатель, потому что проверяющему и отладчику они нужны.
 *
 * Хранилище — localStorage, состояние — `useState`, чтобы значение пережило
 * переход между страницами без повторного чтения и не мигало при гидрации.
 * Ключ в localStorage читается в onMounted: на SSR его нет, и закладывать его в
 * начальное значение нельзя (рассинхрон разметки).
 */

const STORAGE_KEY = 'idea-factory:dev-mode'

export function useDevMode() {
  const enabled = useState<boolean>('dev-mode', () => false)

  function readStored(): boolean {
    if (import.meta.server) {
      return false
    }
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1'
    }
    catch {
      // Приватный режим Safari блокирует localStorage — режим просто остаётся выключенным.
      return false
    }
  }

  function sync(): void {
    enabled.value = readStored()
  }

  function set(value: boolean): void {
    enabled.value = value
    if (import.meta.client) {
      try {
        window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
      }
      catch {
        /* значение живёт до перезагрузки — для отладки этого достаточно */
      }
    }
  }

  function toggle(): void {
    set(!enabled.value)
  }

  return { enabled, set, sync, toggle }
}
