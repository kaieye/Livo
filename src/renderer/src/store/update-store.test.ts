import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUpdateStore } from './update-store'

describe('useUpdateStore update events', () => {
  beforeEach(() => {
    useUpdateStore.setState({
      info: null,
      isChecking: false,
      isInstallingUpdate: false,
      installError: null,
      updateStatus: 'idle',
      downloadProgress: null,
    })
  })

  it('reflects download progress and installation handoff from the main process', () => {
    useUpdateStore.getState().applyUpdateState({
      status: 'downloading',
      percent: 42.5,
      transferred: 425,
      total: 1000,
    })

    expect(useUpdateStore.getState()).toMatchObject({
      updateStatus: 'downloading',
      downloadProgress: 42.5,
      isInstallingUpdate: true,
      installError: null,
    })

    useUpdateStore.getState().applyUpdateState({ status: 'installing' })

    expect(useUpdateStore.getState()).toMatchObject({
      updateStatus: 'installing',
      downloadProgress: 100,
      isInstallingUpdate: true,
    })
  })

  it('uses platform-neutral install capability from update info', () => {
    useUpdateStore.getState().applyUpdateState({
      status: 'available',
      info: {
        hasUpdate: true,
        canInstall: true,
        platform: 'darwin',
        currentVersion: '1.0.0',
        latestVersion: '1.2.0',
      },
    })

    expect(useUpdateStore.getState().info).toMatchObject({
      canInstall: true,
      platform: 'darwin',
    })
  })

  it('refuses to call the installer when the current build cannot update in place', async () => {
    const installUpdate = vi.fn()
    ;(globalThis as unknown as { window: { api: unknown } }).window = {
      api: { app: { installUpdate } },
    }
    useUpdateStore.setState({
      info: {
        hasUpdate: true,
        canInstall: false,
        platform: 'darwin',
        currentVersion: '1.0.0',
        latestVersion: '1.2.0',
      },
    })

    await expect(useUpdateStore.getState().installUpdate()).resolves.toEqual({
      success: false,
      error: '当前 macOS 安装包不支持应用内覆盖安装，请下载 DMG 手动更新',
    })
    expect(installUpdate).not.toHaveBeenCalled()
    expect(useUpdateStore.getState()).toMatchObject({
      isInstallingUpdate: false,
      updateStatus: 'error',
      installError:
        '当前 macOS 安装包不支持应用内覆盖安装，请下载 DMG 手动更新',
    })
  })
})
