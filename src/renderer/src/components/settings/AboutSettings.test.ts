import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

type MockUpdateInfo = {
  hasUpdate: boolean
  canInstall?: boolean
  currentVersion: string
  latestVersion?: string
  publishedAt?: string
  releaseUrl?: string
  error?: string
}

type MockUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

const mocks = vi.hoisted(() => ({
  state: {
    info: null as MockUpdateInfo | null,
    isChecking: false,
    isInstallingUpdate: false,
    installError: null as string | null,
    updateStatus: 'idle' as MockUpdateStatus,
    downloadProgress: null as number | null,
    lastCheckedAt: null as number | null,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../../store/update-store', () => {
  const useUpdateStore = Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    {
      getState: () => mocks.state,
    },
  )

  return { useUpdateStore }
})

import { AboutSettings } from './AboutSettings'

function renderAboutSettings(): string {
  return renderToStaticMarkup(createElement(AboutSettings))
}

afterEach(() => {
  Object.assign(mocks.state, {
    info: null,
    isChecking: false,
    isInstallingUpdate: false,
    installError: null,
    updateStatus: 'idle',
    downloadProgress: null,
    lastCheckedAt: null,
  })
  vi.clearAllMocks()
})

describe('AboutSettings update card', () => {
  it('shows the current version and latest-version feedback on the same line', () => {
    Object.assign(mocks.state, {
      info: {
        hasUpdate: false,
        currentVersion: '9.9.9',
        latestVersion: '9.9.9',
        publishedAt: '2026-07-15T03:18:55.000Z',
      },
      lastCheckedAt: new Date('2026-07-15T03:25:02.000Z').getTime(),
    })

    const html = renderAboutSettings()
    const statusLine = html.match(
      /<div[^>]*aria-live="polite"[^>]*>(.*?)<\/div>/,
    )?.[1]

    expect(statusLine).toContain('settings.version')
    expect(statusLine).toContain('9.9.9')
    expect(statusLine).toContain('settings.updateUnavailable')
    expect(html).not.toContain('settings.currentVersionLabel')
    expect(html).not.toContain('settings.latestVersionLabel')
    expect(html).not.toContain('settings.updatePublishedAt')
    expect(html).not.toContain('最近检查')
  })

  it('shows checking feedback beside the current version', () => {
    Object.assign(mocks.state, {
      info: {
        hasUpdate: false,
        currentVersion: '9.9.9',
      },
      isChecking: true,
      updateStatus: 'checking',
    })

    const html = renderAboutSettings()
    const statusLine = html.match(
      /<div[^>]*aria-live="polite"[^>]*>(.*?)<\/div>/,
    )?.[1]

    expect(statusLine).toContain('settings.version')
    expect(statusLine).toContain('9.9.9')
    expect(statusLine).toContain('settings.checkingUpdates')
  })

  it('replaces the check action with one update button when an update exists', () => {
    Object.assign(mocks.state, {
      info: {
        hasUpdate: true,
        canInstall: true,
        currentVersion: '9.9.9',
        latestVersion: '10.0.0',
        publishedAt: '2026-07-15T03:18:55.000Z',
        releaseUrl: 'https://example.com/releases/v10.0.0',
      },
      updateStatus: 'available',
    })

    const html = renderAboutSettings()

    expect(html).toContain('settings.installUpdate')
    expect(html).toContain('settings.version')
    expect(html).toContain('9.9.9')
    expect(html).not.toContain('settings.updateUnavailable')
    expect(html).not.toContain('settings.updateAvailable')
    expect(html).not.toContain('settings.currentVersionLabel')
    expect(html).not.toContain('settings.latestVersionLabel')
    expect(html).not.toContain('settings.updatePublishedAt')
    expect(html).not.toContain('settings.openReleasePage')
    expect(html).not.toContain('10.0.0')
    expect(html.match(/<button/g)).toHaveLength(1)
  })

  it('shows a generic failure message when checking throws before info is set', () => {
    Object.assign(mocks.state, {
      info: null,
      updateStatus: 'error',
    })

    const html = renderAboutSettings()

    expect(html).toContain('settings.updateCheckFailed')
  })
})
