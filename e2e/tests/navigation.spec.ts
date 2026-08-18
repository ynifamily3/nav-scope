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

test('fixture can navigate between /a, /b, and /c inside a scope', async ({ page }) => {
  await page
    .getByRole('button', {
      name: 'Begin scope',
    })
    .click()

  await page
    .getByRole('button', {
      name: '/b',
    })
    .click()

  await expect(page).toHaveURL('/b')

  await expect(page.locator('#current-path')).toHaveText('/b')

  await page
    .getByRole('button', {
      name: '/c',
    })
    .click()

  await expect(page).toHaveURL('/c')

  await expect(page.locator('#current-path')).toHaveText('/c')

  await page
    .getByRole('button', {
      name: '/a',
    })
    .click()

  await expect(page).toHaveURL('/a')
})

test('reconstructs scope state across browser back and forward traversal', async ({ page }) => {
  const scopeId = await page.evaluate(() => {
    return window.__navScopeTest.begin().scope?.id
  })

  expect(scopeId).toBeDefined()

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  await page.evaluate(() => window.__navScopeTest.push('/c'))

  await expect(page).toHaveURL('/c')

  /**
   * /a
   *  ↓
   * /b [X]
   *  ↓
   * /c [X] ← current
   */

  await page.goBack()

  await expect(page).toHaveURL('/b')

  const atB = await page.evaluate(() => {
    return window.__navScopeTest.snapshot()
  })

  expect(atB.scope?.id).toBe(scopeId)

  expect(atB.scope?.canBack).toBe(false)

  expect(atB.scope?.canForward).toBe(true)

  /**
   * /b → /a
   *
   * anchor는 scope 외부이므로
   * current scope가 없어야 한다.
   */
  await page.goBack()

  await expect(page).toHaveURL('/a')

  const atA = await page.evaluate(() => {
    return window.__navScopeTest.snapshot()
  })

  expect(atA.scope).toBeUndefined()

  /**
   * /a → /b
   *
   * forward traversal로 scope entry에
   * 다시 들어오면 scope가 복원된다.
   */
  await page.goForward()

  await expect(page).toHaveURL('/b')

  const forwardToB = await page.evaluate(() => {
    return window.__navScopeTest.snapshot()
  })

  expect(forwardToB.scope?.id).toBe(scopeId)

  expect(forwardToB.scope?.canBack).toBe(false)

  expect(forwardToB.scope?.canForward).toBe(true)
})

test('restores the correct nested scope when browser traversal changes entries', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__navScopeTest.begin()
  })

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  const outerId = await page.evaluate(() => {
    return window.__navScopeTest.snapshot().scope?.id
  })

  /**
   * 현재 test API에는 child begin이
   * 아직 없으므로 이 테스트는
   * child-scope test API를 추가할 때
   * 활성화한다.
   */

  expect(outerId).toBeDefined()
})
