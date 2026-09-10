import type { StepContext, StepResult } from './types'

import { computeEfficiency } from '../utils/efficiency/compute'

/**
 * Детерминированный исполнитель расчёта эффективности (TZ §5).
 * Число берётся из проверяемого кода, не из LLM (AGENTS.md).
 * Результат сохраняется в calculations + state для следующих шагов.
 */

/** Извлекает транскрипт идеи из state (аналогично llm-executor) */
function getIdeaTranscript(ctx: StepContext): string {
  const ideaAnalysis = ctx.state.idea_analysis as { sourceTranscript?: string } | undefined
  if (ideaAnalysis?.sourceTranscript) {
    return ideaAnalysis.sourceTranscript
  }
  return (ctx.state as { transcript?: string }).transcript ?? ''
}

export const calcExecutor = async (ctx: StepContext): Promise<StepResult> => {
  const output = computeEfficiency({ ideaTranscript: getIdeaTranscript(ctx) })

  // Сохраняем расчёт в таблицу calculations (TZ §5: хранить формулу/версию/входы/параметры/результат)
  await ctx.db.orm.public.Calculations.create({
    ideaId: ctx.ideaId,
    modelVersion: output.result.modelVersion,
    formula: output.result.formula.join('; '),
    params: output.result.mainVariant,
    seed: BigInt(output.seed),
    inputSummary: output.inputSummary,
    result: { result: output.result, decision: output.decision },
    warnings: output.result.warnings,
  })

  return {
    output: {
      calculation: output.result,
      decision: output.decision,
      inputSummary: output.inputSummary,
      seed: output.seed,
      deterministic: true,
      simulation: true,
    },
  }
}
