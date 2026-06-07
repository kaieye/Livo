import { expect, test } from '@playwright/test'

test('web app loads the reader shell', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Livo/)
  await expect(page.locator('#root')).toBeVisible()
  await page.waitForFunction(() => {
    const root = document.querySelector('#root')
    return !!root && (root.textContent?.trim().length ?? 0) > 0
  })
})
