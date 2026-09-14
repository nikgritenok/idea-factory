/**
 * Блок материала фазы — формат, который сервер отдаёт, а UI рендерит
 * настоящими элементами.
 *
 * HTML здесь намеренно не вариант: тексты приходят из модели, и подставлять их
 * через `v-html` означало бы и XSS-поверхность, и конфликт с `vue/no-v-html`.
 * Скачивание .md собирается из этих же блоков (`blocksToMarkdown`), поэтому
 * экран и файл всегда показывают одно и то же.
 */
export type MaterialBlock
  = | { level: 1 | 2 | 3, text: string, type: 'h' }
    | { text: string, type: 'li' }
    | { text: string, type: 'p' }
    | { text: string, type: 'pre' }

/** Ответ GET /api/ideas/:id/phases/:role/materials */
export interface PhaseMaterials {
  blocks: MaterialBlock[]
  generatedAt: string
  markdown: string
  phase: { role: string, title: string }
  source: { createdAt: string, runId: null | string }
}
