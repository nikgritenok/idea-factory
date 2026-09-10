/**
 * Конфиг роли Редактор отчёта (pipeline step: report_build).
 * Детерминированная сборка отчёта из результатов предыдущих шагов.
 * Не LLM-роль — сборка программная (fixture executor).
 */

export const reportEditorRole = {
  id: 'report_editor',
  title: 'Редактор отчёта',

  /** Описание того, что делает этот шаг (для документации) */
  description: 'Детерминированная сборка итогового отчта из результатов предыдущих шагов анализа. Не использует LLM — просто компилирует данные в структурированный документ.',

  /**
   * Логика сборки отчёта (реализуется в report-builder.ts, не здесь).
   * Этот конфиг — для документации и progressBar.
   */
  buildLogic: (results: Record<string, unknown>) => {
    const orchestrator = results.orchestrator_plan as { pipelineVersion?: string } | undefined
    return {
      summary: {
        idea: results.idea_analysis,
        recommendation: results.critic_review,
      },
      market: results.market_research,
      strategy: results.strategy,
      efficiency: results.efficiency_model,
      critic: results.critic_review,
      meta: {
        pipelineVersion: orchestrator?.pipelineVersion ?? 'v1',
        generatedAt: new Date().toISOString(),
      },
    }
  },
}
