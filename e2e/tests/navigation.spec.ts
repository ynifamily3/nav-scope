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

test('reconstructs the current scope after reload', async ({ page }) => {
  const before = await page.evaluate(() => {
    return window.__navScopeTest.begin().scope
  })

  expect(before).toBeDefined()

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  await page.evaluate(() => window.__navScopeTest.push('/c'))

  await expect(page).toHaveURL('/c')

  const beforeReload = await page.evaluate(() => {
    return window.__navScopeTest.snapshot().scope
  })

  expect(beforeReload?.id).toBe(before?.id)

  /**
   * JS runtime은 여기서 완전히 새로 만들어진다.
   */
  await page.reload()

  await expect(page).toHaveURL('/c')

  const afterReload = await page.evaluate(() => {
    return window.__navScopeTest.snapshot().scope
  })

  expect(afterReload).toBeDefined()

  expect(afterReload?.id).toBe(beforeReload?.id)

  expect(afterReload?.anchorKey).toBe(beforeReload?.anchorKey)

  expect(
    afterReload?.entries.map((entry) => {
      if (!entry.url) {
        return null
      }

      return new URL(entry.url).pathname
    }),
  ).toEqual(['/b', '/c'])

  /**
   * reload 전에 생성했던 Scope 객체는
   * 이미 사라졌다.
   *
   * 그런데 history metadata에서 복원된
   * 새 Scope 객체로 exit할 수 있어야 한다.
   */
  await page.evaluate(() => window.__navScopeTest.exit())

  await expect(page).toHaveURL('/a')

  const finalScope = await page.evaluate(() => {
    return window.__navScopeTest.snapshot().scope
  })

  expect(finalScope).toBeUndefined()
})
