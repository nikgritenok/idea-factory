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
    formula: output.result.formula.join('; '),
    ideaId: ctx.ideaId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSummary: output.inputSummary as any,
    modelVersion: output.result.modelVersion,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: JSON.parse(JSON.stringify(output.result.mainVariant)) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: JSON.parse(JSON.stringify({ decision: output.decision, result: output.result })) as any,
    seed: BigInt(output.seed),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    warnings: JSON.parse(JSON.stringify(output.result.warnings)) as any,
  })

  return {
    output: {
      calculation: output.result,
      decision: output.decision,
      deterministic: true,
      inputSummary: output.inputSummary,
      seed: output.seed,
      simulation: true,
    },
  }
}
