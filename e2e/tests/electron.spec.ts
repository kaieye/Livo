import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test('electron app opens the main window with isolated userData', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'livo-e2e-'))
  const env = { ...process.env }
  // 测试宿主可能设置 ELECTRON_RUN_AS_NODE，启动真实 Electron 时必须移除。
  delete env.ELECTRON_RUN_AS_NODE

  const electronApp = await electron.launch({
    args: [resolve('out/main/index.js'), 'livo://settings?tab=data'],
    env: {
      ...env,
      LIVO_E2E: '1',
      LIVO_E2E_USER_DATA: userDataDir,
    },
  })

  try {
    const window = await electronApp.firstWindow()
    await expect(window.locator('#root')).toBeVisible()
    await window.waitForFunction(() => {
      const root = document.querySelector('#root')
      return !!root && (root.textContent?.trim().length ?? 0) > 0
    })

    const actualUserData = await electronApp.evaluate(({ app }) =>
      app.getPath('userData'),
    )
    expect(actualUserData).toBe(userDataDir)
    await expect
      .poll(() => window.evaluate(() => window.location.hash))
      .toContain('/settings')
  } finally {
    await electronApp.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})
