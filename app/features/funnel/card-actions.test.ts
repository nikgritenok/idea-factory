import { describe, expect, it } from 'vitest'

import type { JobSnapshot } from './card-actions'

import { planCardActions } from './card-actions'

function job(status: string, currentStep: null | string = null): JobSnapshot {
  return { currentStep, id: 'job-1', status }
}

describe('planCardActions', () => {
  it('в архиве нет ни «Запустить анализ», ни «В архив» — только вернуть и удалить', () => {
    const plan = planCardActions('archived', null)
    expect(plan.actions).toEqual(['restore', 'delete'])
  })

  it('во время прогона кнопки запуска нет: есть плашка статуса и остановка', () => {
    const plan = planCardActions('research', job('running', 'поиск аналогов на рынке'))

    expect(plan.actions).toEqual(['stop', 'archive'])
    expect(plan.plate?.text).toBe('Идёт анализ · поиск аналогов на рынке')
  })

  it('queued — тоже активная задача: остановка, а не запуск', () => {
    const plan = planCardActions('queued', job('queued'))

    expect(plan.actions).toEqual(['stop', 'archive'])
    expect(plan.plate?.text).toBe('Идея в очереди')
  })

  it('paused даёт продолжение, а не новый запуск', () => {
    expect(planCardActions('research', job('paused')).actions).toEqual(['resume', 'archive'])
  })

  it('failed даёт перезапуск (идемпотентность /run не распространяется на завершённые)', () => {
    const plan = planCardActions('research', job('failed'))

    expect(plan.actions).toEqual(['run', 'archive'])
    expect(plan.plate?.text).toBe('Прогон упал')
  })

  it('завершённая (done) задача не показывает «идёт анализ»', () => {
    const plan = planCardActions('decision', job('done'))

    expect(plan.plate).toBeNull()
    expect(plan.actions).toEqual(['run', 'archive'])
  })

  it('mvp_ready не предлагает анализ повторно', () => {
    expect(planCardActions('mvp_ready', null).actions).toEqual(['archive'])
  })

  it('обычная идея без задачи — запуск + архив', () => {
    expect(planCardActions('draft', null).actions).toEqual(['run', 'archive'])
  })

  it('пока статус прогона не известен — запуска нет (иначе карточка мигает «Запустить» → «Остановить»)', () => {
    const plan = planCardActions('draft', null, false)

    expect(plan.actions).toEqual(['archive'])
    expect(plan.plate).toBeNull()
  })

  it('архив остаётся вернуть/удалить даже при неизвестном статусе', () => {
    expect(planCardActions('archived', null, false).actions).toEqual(['restore', 'delete'])
  })
})
