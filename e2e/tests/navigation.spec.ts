import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/a')
})

test('exits directly to the scope anchor', async ({ page }) => {
  await page.evaluate(() => {
    window.__navScopeTest.begin()
  })

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  await page.evaluate(() => window.__navScopeTest.push('/c'))

  await expect(page).toHaveURL('/c')

  await page.evaluate(() => window.__navScopeTest.exit())

  await expect(page).toHaveURL('/a')
})

test('keeps the same entry key on replace', async ({ page }) => {
  await page.evaluate(() => {
    window.__navScopeTest.begin()
  })

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  const before = await page.evaluate(() => window.__navScopeTest.snapshot().current.key)

  await page.evaluate(() => window.__navScopeTest.replace('/c'))

  const after = await page.evaluate(() => window.__navScopeTest.snapshot().current.key)

  expect(after).toBe(before)

  await expect(page).toHaveURL('/c')
})

test('leaves scope entries reachable through forward navigation after exit', async ({ page }) => {
  await page.evaluate(() => {
    window.__navScopeTest.begin()
  })

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  await page.evaluate(() => window.__navScopeTest.push('/c'))

  await page.evaluate(() => window.__navScopeTest.exit())

  await expect(page).toHaveURL('/a')

  await page.goForward()

  await expect(page).toHaveURL('/b')
})

test('round-trips scope metadata through Navigation API state', async ({ page }) => {
  const scopeId = await page.evaluate(() => {
    return window.__navScopeTest.begin().scope?.id
  })

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  const metadata = await page.evaluate(() => {
    return window.__navScopeTest.snapshot().current.navScope
  })

  expect(metadata).toEqual({
    version: 1,

    scopes: [
      expect.objectContaining({
        id: scopeId,
      }),
    ],
  })
})
