import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'

test('web app loads the reader shell', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Livo/)
  await expect(page.locator('#root')).toBeVisible()
  await page.waitForFunction(() => {
    const root = document.querySelector('#root')
    return !!root && (root.textContent?.trim().length ?? 0) > 0
  })
})

test('opening the selected entry image does not trigger a React update loop', async ({
  page,
}) => {
  const pageErrors: string[] = []
  const harnessPath = `/@fs/${resolve('e2e/fixtures/deep-link-entry-harness.ts')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')}`
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.route('**/__deep-link-entry-harness', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><body><div id="root"></div></body></html>',
    })
  })
  await page.goto('/__deep-link-entry-harness')

  await page.evaluate(async (modulePath) => {
    const { mountDeepLinkEntryHarness } = await import(modulePath)
    await mountDeepLinkEntryHarness()
  }, harnessPath)

  await page.waitForTimeout(250)

  expect(pageErrors).not.toEqual(
    expect.arrayContaining([
      expect.stringContaining('Maximum update depth exceeded'),
    ]),
  )
  await expect(page.locator('#root')).not.toContainText(
    'Maximum update depth exceeded',
  )
  await expect(page.locator('[data-entry-id="e2e-image-entry"]')).toHaveText(
    'Selected image entry',
  )
})
