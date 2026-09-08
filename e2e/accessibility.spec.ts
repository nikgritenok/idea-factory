import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

test('homepage has no accessibility violations', async ({ page }) => {
  await page.goto('/')

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze()

  expect(results.violations).toEqual([])
})

test('ideas page has no accessibility violations', async ({ page }) => {
  await page.goto('/ideas')

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze()

  expect(results.violations).toEqual([])
})

test('idea card page has no accessibility violations', async ({ page }) => {
  await page.goto('/ideas')

  const firstCard = page.locator('[data-testid="idea-card"]').first()
  if (await firstCard.isVisible()) {
    await firstCard.click()
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze()

    expect(results.violations).toEqual([])
  }
})
