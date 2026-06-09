import { expect, test } from '@playwright/test'
import { _electron as electron } from 'playwright'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

test.describe.configure({ mode: 'serial' })

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

test('electron auth store uses isolated userData before main services load', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'livo-e2e-auth-'))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE

  const sessionPath = join(userDataDir, 'livo-auth-session.json')
  const session = {
    token: 'test-token',
    userId: 'user_e2e_auth_store',
    user: {
      id: 'user_e2e_auth_store',
      displayName: 'E2E User',
      avatarUrl: null,
      role: 'user',
      status: 'active',
      createdAt: '2026-06-09T00:00:00.000Z',
      providers: ['google'],
      identities: [],
    },
    expiresAt: Date.now() + 60 * 60 * 1000,
  }

  await mkdir(userDataDir, { recursive: true })
  await writeFile(sessionPath, JSON.stringify({ session }), 'utf8')

  const electronApp = await electron.launch({
    args: [resolve('out/main/index.js'), 'livo://settings?tab=data'],
    env: {
      ...env,
      LIVO_E2E: '1',
      LIVO_E2E_USER_DATA: userDataDir,
      LIVO_SERVER_BASE_URL: 'http://127.0.0.1:9',
    },
  })

  try {
    const window = await electronApp.firstWindow()
    await expect(window.locator('#root')).toBeVisible()

    const actualUserData = await electronApp.evaluate(({ app }) =>
      app.getPath('userData'),
    )
    expect(actualUserData).toBe(userDataDir)

    await expect
      .poll(() => window.evaluate(() => window.api.feeds.syncStatus()))
      .toMatchObject({
        isAuthenticated: true,
        pendingChanges: 0,
      })
  } finally {
    await electronApp.close()
    await rm(userDataDir, { recursive: true, force: true })
  }
})
