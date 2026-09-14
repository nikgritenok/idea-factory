import { describe, expect, it } from 'vitest'

import { PIPELINE_STEPS } from '~~/config/pipeline'
import { phaseCopy, phaseLabel, phaseRole, phaseTitle, PHASES, PIPELINE_PHASES } from './phase-names'

/**
 * Покрытие человеческими подписями. Ловит конкретный регресс: в pipeline добавили
 * роль или шаг, а в UI он снова показывается техническим id.
 */
describe('Человеческие названия фаз', () => {
  it('каждая роль пайплайна имеет копию', () => {
    for (const step of PIPELINE_STEPS) {
      expect(phaseRole(step.role), `роль ${step.role} без человеческой подписи`).not.toBeNull()
      // phaseCopy, а не PHASES[role]: индексация Record по строке даёт PhaseCopy
      // без `undefined`, и `?.` считался бы мёртвым кодом — при этом роли из БД
      // реально могут не быть в словаре.
      const copy = phaseCopy(step.role)
      expect(copy?.running, `у ${step.role} нет фазы «идёт сейчас»`).toMatch(/\S{3,}/)
      expect(copy?.done, `у ${step.role} нет фазы «готово»`).toMatch(/\S{3,}/)
      expect(copy?.title, `у ${step.role} нет короткого имени`).toMatch(/\S{2,}/)
    }
  })

  it('каждый id шага маппится в роль', () => {
    for (const step of PIPELINE_STEPS) {
      expect(phaseRole(step.id), `шаг ${step.id} не маппится`).toBe(step.role)
    }
  })

  it('список фаз для UI не разъехался с pipeline', () => {
    // Дублирование осознанное (в браузер нельзя тянуть zod и серверные схемы),
    // поэтому расхождение по id, порядку или роли — красный тест, а не «пользователь
    // видит фазы в чужом порядке».
    expect(PIPELINE_PHASES.map(p => p.id)).toEqual(PIPELINE_STEPS.map(s => s.id))
    expect(PIPELINE_PHASES.map(p => p.role)).toEqual(PIPELINE_STEPS.map(s => s.role))
  })

  it('ни одна подпись не похожа на технический id и все они по-русски', () => {
    for (const [role, copy] of Object.entries(PHASES)) {
      for (const text of [copy.title, copy.running, copy.done]) {
        expect(text, `подпись роли ${role} похожа на технический id`).not.toMatch(/[a-z_]{4,}/)
        expect(text, `подпись роли ${role} не по-русски`).toMatch(/[\u0410-\u044f]/)
      }
    }
  })

  it('неизвестная фаза не показывает сырой id владельцу', () => {
    expect(phaseLabel('some_new_step', 'running')).toBe('Работаем над идеей')
    expect(phaseLabel(null)).toBe('Работаем над идеей')
    expect(phaseTitle('несуществующая_роль')).toBe('Этап')
  })

  it('id шага и роль дают одну и ту же фразу', () => {
    expect(phaseLabel('critic_review', 'running')).toBe(phaseLabel('critic', 'running'))
    expect(phaseLabel('efficiency_model', 'done')).toBe('Посчитал эффект в цифрах')
    expect(phaseTitle('market_research')).toBe('Рынок и конкуренты')
  })
})
