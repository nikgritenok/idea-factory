import { describe, expect, it } from 'vitest'

import { FIXTURE_ROLES, getRoleConfig, LLM_ROLES, ROLE_CONFIGS } from './index'

describe('Конфиги ролей', () => {
  it('содержит все 7 ролей', () => {
    expect(Object.keys(ROLE_CONFIGS)).toHaveLength(7)
  })

  it('LLM_ROLES содержит 6 ролей', () => {
    expect(LLM_ROLES).toHaveLength(6)
    expect(LLM_ROLES).toContain('orchestrator')
    expect(LLM_ROLES).toContain('idea_analyst')
    expect(LLM_ROLES).toContain('market_analyst')
    expect(LLM_ROLES).toContain('strategist')
    expect(LLM_ROLES).toContain('efficiency_analyst')
    expect(LLM_ROLES).toContain('critic')
  })

  it('FIXTURE_ROLES содержит 1 роль', () => {
    expect(FIXTURE_ROLES).toHaveLength(1)
    expect(FIXTURE_ROLES).toContain('report_editor')
  })

  it('getRoleConfig возвращает конфиг по ID', () => {
    const orchestrator = getRoleConfig('orchestrator')
    expect(orchestrator).toBeDefined()
    expect(orchestrator?.id).toBe('orchestrator')
    expect(orchestrator?.title).toBe('Оркестратор')
  })

  it('getRoleConfig возвращает undefined для неизвестной роли', () => {
    expect(getRoleConfig('unknown')).toBeUndefined()
  })

  it('все LLM-роли имеют system prompt и schema', () => {
    for (const roleId of LLM_ROLES) {
      const config = getRoleConfig(roleId)
      expect(config).toBeDefined()
      expect('system' in config!).toBe(true)
      expect('schema' in config!).toBe(true)
      expect('temperature' in config!).toBe(true)
      expect('maxTokens' in config!).toBe(true)
    }
  })

  it('каждая роль имеет уникальный id', () => {
    const ids = Object.values(ROLE_CONFIGS).map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
