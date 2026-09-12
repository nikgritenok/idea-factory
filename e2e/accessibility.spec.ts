import type { Page } from '@playwright/test'

import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

/**
 * Навигация в capture-режиме: `?motion=off` ставит MotionConfig в
 * `reducedMotion: "always"` (см. app/app.vue), поэтому axe не сканирует
 * элементы в середине анимации — иначе ложные срабатывания на контраст и
 * видимость фокуса зависят от тайминга.
 */
async function gotoQuiet(page: Page, path: string) {
  await page.goto(`${path}${path.includes('?') ? '&' : '?'}motion=off`)
  await page.waitForLoadState('networkidle')
}

test('homepage has no accessibility violations', async ({ page }) => {
  await gotoQuiet(page, '/')

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze()

  expect(results.violations).toEqual([])
})

test('ideas page has no accessibility violations', async ({ page }) => {
  await gotoQuiet(page, '/ideas')

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze()

  expect(results.violations).toEqual([])
})

test('idea card page has no accessibility violations', async ({ page }) => {
  await gotoQuiet(page, '/ideas')

  const firstCard = page.locator('[data-testid="idea-card"]').first()
  if (await firstCard.isVisible()) {
    await firstCard.click()
    // Клик ведёт на /ideas/<id> без query — перенавигациируем тот же путь в capture-режиме.
    await page.waitForURL(/\/ideas\/[^/]+$/)
    await gotoQuiet(page, new URL(page.url()).pathname)

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze()

    expect(results.violations).toEqual([])
  }
})
