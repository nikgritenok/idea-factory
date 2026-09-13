import { expect, test } from '@playwright/test'

test('homepage loads and shows title', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('text=Фабрика идей')).toBeVisible()
})

test('homepage has correct meta title', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Фабрика идей/)
})

test('API returns request-id header', async ({ request }) => {
  const response = await request.get('/api/ideas')
  const requestId = response.headers()['x-request-id']
  expect(requestId).toBeTruthy()
  expect(typeof requestId).toBe('string')
})

test('mobile nav highlights exactly one current page', async ({ page }) => {
  // Бар виден только < md (md:hidden = display:none, а display:none нет в дереве
  // доступности) — без мобильного вьюпорта getByRole навигацию не найдёт.
  await page.setViewportSize({ height: 780, width: 360 })
  await page.goto('/')

  const mobileNav = page.getByRole('navigation', { name: 'Мобильная навигация' })
  await expect(mobileNav).toBeVisible()
  await expect(mobileNav.locator('[aria-current="page"]')).toHaveCount(1)
})
