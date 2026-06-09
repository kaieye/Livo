import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}))

const sessionStoreMock = vi.hoisted(() => ({
  getSession: vi.fn(),
  isSessionValid: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}))

const logWarnQuietMock = vi.hoisted(() => vi.fn())

vi.mock('./auth-service', () => ({
  authService: authServiceMock,
}))

vi.mock('./session-store', () => ({
  sessionStore: sessionStoreMock,
}))

vi.mock('../system/logger', () => ({
  logWarnQuiet: logWarnQuietMock,
}))

import { getValidatedSession } from './session-validation'

const backendUser = {
  id: 'user-current',
  displayName: 'Current User',
  avatarUrl: null,
  role: 'user',
  status: 'active',
  createdAt: '2026-06-09T00:00:00.000Z',
}

const localSession = {
  token: 'session-token',
  userId: 'user-stale',
  user: {
    ...backendUser,
    id: 'user-stale',
  },
  expiresAt: Date.now() + 1000,
}

describe('getValidatedSession', () => {
  beforeEach(() => {
    authServiceMock.getCurrentUser.mockReset()
    sessionStoreMock.getSession.mockReset()
    sessionStoreMock.isSessionValid.mockReset()
    sessionStoreMock.saveSession.mockReset()
    sessionStoreMock.clearSession.mockReset()
    logWarnQuietMock.mockReset()
  })

  it('returns null when there is no local session', async () => {
    sessionStoreMock.getSession.mockReturnValue(null)

    await expect(getValidatedSession()).resolves.toBeNull()

    expect(sessionStoreMock.isSessionValid).not.toHaveBeenCalled()
    expect(authServiceMock.getCurrentUser).not.toHaveBeenCalled()
  })

  it('verifies the local token against the backend before returning a session', async () => {
    sessionStoreMock.getSession.mockReturnValue(localSession)
    sessionStoreMock.isSessionValid.mockReturnValue(true)
    authServiceMock.getCurrentUser.mockResolvedValue(backendUser)

    await expect(getValidatedSession()).resolves.toEqual({
      token: localSession.token,
      user: backendUser,
    })

    expect(authServiceMock.getCurrentUser).toHaveBeenCalledWith(
      localSession.token,
    )
    expect(sessionStoreMock.saveSession).toHaveBeenCalledWith({
      ...localSession,
      userId: backendUser.id,
      user: backendUser,
    })
  })

  it('clears stale local sessions rejected by the backend', async () => {
    const error = new Error('Failed to get user info: 401')
    sessionStoreMock.getSession.mockReturnValue(localSession)
    sessionStoreMock.isSessionValid.mockReturnValue(true)
    authServiceMock.getCurrentUser.mockRejectedValue(error)

    await expect(getValidatedSession()).resolves.toBeNull()

    expect(sessionStoreMock.clearSession).toHaveBeenCalledTimes(1)
    expect(logWarnQuietMock).toHaveBeenCalledWith(
      '[auth-session-invalid-cleared]',
      error,
    )
  })

  it('keeps the local session when backend validation is temporarily unavailable', async () => {
    const error = new Error('fetch failed')
    sessionStoreMock.getSession.mockReturnValue(localSession)
    sessionStoreMock.isSessionValid.mockReturnValue(true)
    authServiceMock.getCurrentUser.mockRejectedValue(error)

    await expect(getValidatedSession()).resolves.toEqual({
      token: localSession.token,
      user: localSession.user,
    })

    expect(sessionStoreMock.clearSession).not.toHaveBeenCalled()
    expect(logWarnQuietMock).toHaveBeenCalledWith(
      '[auth-session-validation-unavailable]',
      error,
    )
  })
})
