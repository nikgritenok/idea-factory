import { describe, expect, it } from 'vitest'

import { COMPONENTS, getAllComponents, getComponent } from './index'

describe('Каталог компонентов', () => {
  it('содержит 3 компонента', () => {
    expect(Object.keys(COMPONENTS)).toHaveLength(3)
  })

  it('getComponent возвращает компонент по ID', () => {
    const llm = getComponent('llm')
    expect(llm).toBeDefined()
    expect(llm?.id).toBe('llm')
    expect(llm?.name).toContain('LLM')
  })

  it('getComponent возвращает undefined для неизвестного ID', () => {
    expect(getComponent('unknown')).toBeUndefined()
  })

  it('getAllComponents возвращает все компоненты', () => {
    const components = getAllComponents()
    expect(components).toHaveLength(3)
  })

  it('каждый компонент имеет обязательные поля', () => {
    for (const component of Object.values(COMPONENTS)) {
      expect(component.id).toBeDefined()
      expect(component.name).toBeDefined()
      expect(component.version).toBeDefined()
      expect(component.api).toBeDefined()
      expect(component.input).toBeDefined()
      expect(component.output).toBeDefined()
      expect(Array.isArray(component.dependencies)).toBe(true)
      expect(Array.isArray(component.limitations)).toBe(true)
      expect(Array.isArray(component.metrics)).toBe(true)
    }
  })

  it('LLM компонент имеет correct endpoint', () => {
    const llm = getComponent('llm')
    expect(llm?.api.endpoint).toContain('routerai.ru')
    expect(llm?.api.method).toBe('POST')
  })

  it('STT компонент имеет correct endpoint', () => {
    const stt = getComponent('stt')
    expect(stt?.api.endpoint).toContain('routerai.ru')
    expect(stt?.api.method).toBe('POST')
  })

  it('Validator компонент имеет correct endpoint', () => {
    const validator = getComponent('validator')
    expect(validator?.api.endpoint).toContain('localhost:3001')
    expect(validator?.api.method).toBe('POST')
  })
})
