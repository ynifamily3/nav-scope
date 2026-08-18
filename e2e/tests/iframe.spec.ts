import { expect, test } from '@playwright/test'

test('iframe navigation does not affect top-level scope traversal', async ({ page }) => {
  await page.goto('/a')

  await page.evaluate(() => {
    window.__navScopeTest.begin()
  })

  await page.evaluate(() => window.__navScopeTest.push('/b'))

  const beforeIframe = await page.evaluate(() => window.__navScopeTest.snapshot())

  expect(beforeIframe.entries).toHaveLength(2)

  const frame = page.frameLocator('#child-frame')

  await frame.locator('[data-step="1"]').click()

  await expect(frame.locator('#current-step')).toHaveText('1')

  await frame.locator('[data-step="2"]').click()

  await expect(frame.locator('#current-step')).toHaveText('2')

  await frame.locator('[data-step="3"]').click()

  await expect(frame.locator('#current-step')).toHaveText('3')

  const afterIframe = await page.evaluate(() => window.__navScopeTest.snapshot())

  /**
   * iframe 안에서 세 번 이동했지만
   * top-level Navigation entries에는
   * 여전히 /a, /b만 존재해야 한다.
   */
  expect(afterIframe.entries).toHaveLength(2)

  await page.evaluate(() => window.__navScopeTest.push('/c'))

  await expect(page).toHaveURL('/c')

  await page.evaluate(() => window.__navScopeTest.exit())

  /**
   * iframe의 traversal 개수와 상관없이
   * 정확히 top-level scope anchor인
   * /a로 이동한다.
   */
  await expect(page).toHaveURL('/a')
})
