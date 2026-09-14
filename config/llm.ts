/**
 * Конфиг LLM-провайдера (TZ §6: модели и лимиты — в /config, отдельно от логики).
 *
 * Почему модуль, а не константы в server/utils/llm.ts: провайдер сменился, и
 * зашитые `https://routerai.ru/api/v1` + `z-ai/glm-5.3-flash` превратились в
 * причину падения всех LLM-шагов (прогон умирал на «HTTP 401» ещё до первого
 * материала). Теперь база, модель и ключ задаются окружением, значение по
 * умолчанию — рабочий провайдер.
 *
 * Ключ читается из process.env намеренно: этот модуль используют и Nitro-рантайм,
 * и standalone-воркер (`pnpm worker` = tsx вне Nuxt), а `useRuntimeConfig()`
 * во втором недоступен. Значение не попадает ни в какой клиентский бандл.
 */

/** Имя переменной-наследника: ROUTERAI_API_KEY остаётся работающим (Dokploy, тесты). */
const ENV = process.env

export const LLM_DEFAULT_BASE_URL = 'https://api.b.ai/v1'
export const LLM_DEFAULT_MODEL = 'qwen3.8-flash'

/**
 * Пустая строка в переменных окружения означает «не задано» (Dokploy умеет
 * отдавать `LLM_MODEL=`), поэтому обычный `??` не спасает — срезаем пробелы
 * и смотрим на длину.
 */
function envOr(value: string | undefined, fallback: string): string {
  const configured = value?.trim()
  return configured && configured.length > 0 ? configured : fallback
}

export function getLlmBaseUrl(): string {
  return envOr(ENV.LLM_BASE_URL, LLM_DEFAULT_BASE_URL).replace(/\/+$/, '')
}

export function getLlmModel(): string {
  return envOr(ENV.LLM_MODEL, LLM_DEFAULT_MODEL)
}

/**
 * Серверный только ключ. Пустая строка = «не настроен» (вызывающий отдаёт 503).
 *
 * Фолбэк на ROUTERAI_API_KEY был УБРАН намеренно: он тихо подсовывал ключ одного
 * провайдера в API другого, и вместо честного «ключа нет» прогон умирал на
 * `401 Invalid api_key format` (замерено на публичном стенде 2026-09-14).
 * ROUTERAI_API_KEY остаётся ключом транскрибации (server/utils/stt.ts) — это
 * другой сервис и другая переменная.
 */
export function getLlmApiKey(): string {
  return envOr(ENV.LLM_API_KEY, '')
}

/**
 * Для логов и экранов: что за провайдер реально используется.
 * Значения ключа здесь нет и быть не может — только факт, задан ли он.
 */
export function describeLlmConfig(): { baseUrl: string, hasKey: boolean, model: string } {
  return { baseUrl: getLlmBaseUrl(), hasKey: getLlmApiKey().length > 0, model: getLlmModel() }
}
