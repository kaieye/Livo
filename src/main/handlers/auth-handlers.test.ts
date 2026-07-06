import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))
vi.mock('../ipc/register-channel', () => ({ registerChannel: vi.fn() }))
vi.mock('../services/auth/auth-service', () => ({
  authService: {},
}))
vi.mock('../services/auth/session-store', () => ({
  sessionStore: {},
}))
vi.mock('../services/auth/session-validation', () => ({
  getValidatedSession: vi.fn(),
}))
vi.mock('../services/feed/feed-sync-service', () => ({
  feedSyncService: { syncNow: vi.fn() },
}))
vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
}))
vi.mock('../services/backend/backend-config', () => ({
  getBackendBaseUrl: () => 'https://api.livo.example',
}))

import { isAuthPopupUrlAllowed } from './auth-handlers'

describe('auth popup navigation policy', () => {
  it('allows backend and expected provider URLs', () => {
    expect(
      isAuthPopupUrlAllowed('google', 'https://api.livo.example/auth/callback'),
    ).toBe(true)
    expect(
      isAuthPopupUrlAllowed(
        'google',
        'https://accounts.google.com/o/oauth2/v2/auth',
      ),
    ).toBe(true)
    expect(
      isAuthPopupUrlAllowed('wechat', 'https://open.weixin.qq.com/connect/qr'),
    ).toBe(true)
  })

  it('blocks backend-supplied arbitrary HTTPS URLs', () => {
    expect(isAuthPopupUrlAllowed('google', 'https://evil.example/login')).toBe(
      false,
    )
    expect(
      isAuthPopupUrlAllowed('wechat', 'https://weixin.qq.com.evil.example/'),
    ).toBe(false)
  })
})
