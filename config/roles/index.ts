import { criticRole } from './critic'
import { efficiencyAnalystRole } from './efficiency-analyst'
import { ideaAnalystRole } from './idea-analyst'
import { marketAnalystRole } from './market-analyst'
import { orchestratorRole } from './orchestrator'
import { reportEditorRole } from './report-editor'
import { strategistRole } from './strategist'

/**
 * Реестр ролей пайплайна анализа.
 * Ключ = role из config/pipeline.ts.
 * executor: 'llm' — вызов LLM с валидацией ответа
 * executor: 'fixture' — детерминированная сборка (report_editor)
 */

export const ROLE_CONFIGS = {
  orchestrator: orchestratorRole,
  idea_analyst: ideaAnalystRole,
  market_analyst: marketAnalystRole,
  strategist: strategistRole,
  efficiency_analyst: efficiencyAnalystRole,
  critic: criticRole,
  report_editor: reportEditorRole,
} as const

export type RoleId = keyof typeof ROLE_CONFIGS

/** Получить конфиг роли по ID */
export function getRoleConfig(roleId: string): (typeof ROLE_CONFIGS)[RoleId] | undefined {
  return ROLE_CONFIGS[roleId as RoleId]
}

/** Все LLM-роли (используют LLM, не fixture) */
export const LLM_ROLES: readonly string[] = [
  'orchestrator',
  'idea_analyst',
  'market_analyst',
  'strategist',
  'efficiency_analyst',
  'critic',
]

/** Все fixture-роли (детерминированная сборка) */
export const FIXTURE_ROLES: readonly string[] = [
  'report_editor',
]

export { criticRole } from './critic'
export { efficiencyAnalystRole } from './efficiency-analyst'
export { ideaAnalystRole } from './idea-analyst'
export { marketAnalystRole } from './market-analyst'
export { orchestratorRole } from './orchestrator'
export { reportEditorRole } from './report-editor'
export { strategistRole } from './strategist'
