import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userDataPath: '',
  tempPath: '',
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) =>
      name === 'temp' ? mocks.tempPath : mocks.userDataPath,
    ),
  },
  BrowserWindow: vi.fn(),
  session: {
    defaultSession: {
      cookies: {
        get: vi.fn(),
        remove: vi.fn(),
      },
      fetch: vi.fn(),
    },
  },
}))

vi.mock('./google-oauth', () => ({
  getGoogleOAuthAccountState: vi.fn(),
  linkGoogleOAuthAccount: vi.fn(),
  unlinkGoogleOAuthAccount: vi.fn(),
}))

describe('account auth login navigation policy', () => {
  beforeEach(() => {
    mocks.userDataPath = mkdtempSync(join(tmpdir(), 'livo-account-test-'))
    mocks.tempPath = mkdtempSync(join(tmpdir(), 'livo-account-temp-'))
  })

  afterEach(() => {
    rmSync(mocks.userDataPath, { recursive: true, force: true })
    rmSync(mocks.tempPath, { recursive: true, force: true })
    vi.resetModules()
  })

  it('allows only provider login hosts for cookie account windows', async () => {
    const { isCookieProviderLoginUrlAllowed } = await import('./account-auth')

    expect(
      isCookieProviderLoginUrlAllowed(
        'youtube',
        'https://accounts.google.com/ServiceLogin',
      ),
    ).toBe(true)
    expect(
      isCookieProviderLoginUrlAllowed('youtube', 'https://m.youtube.com/'),
    ).toBe(true)
    expect(
      isCookieProviderLoginUrlAllowed('x', 'https://twitter.com/i/flow/login'),
    ).toBe(true)
    expect(
      isCookieProviderLoginUrlAllowed('youtube', 'https://evil.example/login'),
    ).toBe(false)
    expect(
      isCookieProviderLoginUrlAllowed(
        'x',
        'https://x.com.evil.example/i/flow/login',
      ),
    ).toBe(false)
  })
})
