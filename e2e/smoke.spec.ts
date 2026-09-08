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
