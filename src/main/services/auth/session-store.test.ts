import { beforeEach, describe, expect, it, vi } from 'vitest'

const storeState = vi.hoisted(() => new Map<string, unknown>())
const safeStorageMock = vi.hoisted(() => ({
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((value: string) =>
    Buffer.from(`encrypted:${value}`, 'utf8'),
  ),
  decryptString: vi.fn((value: Buffer) =>
    value.toString('utf8').replace(/^encrypted:/, ''),
  ),
}))

vi.mock('electron-store', () => ({
  default: vi.fn().mockImplementation(() => ({
    set: (key: string, value: unknown) => storeState.set(key, value),
    get: (key: string) => storeState.get(key),
    delete: (key: string) => storeState.delete(key),
  })),
}))

vi.mock('electron', () => ({
  safeStorage: safeStorageMock,
}))

import { SessionStore, type SessionData } from './session-store'

const session: SessionData = {
  token: 'secret-token',
  userId: 'user-1',
  user: {
    id: 'user-1',
    displayName: 'Alice',
    avatarUrl: null,
    role: 'user',
    status: 'active',
    createdAt: '2026-07-07T00:00:00.000Z',
  },
  expiresAt: Date.now() + 1000,
}

describe('SessionStore', () => {
  beforeEach(() => {
    storeState.clear()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    safeStorageMock.encryptString.mockClear()
    safeStorageMock.decryptString.mockClear()
  })

  it('persists tokens encrypted instead of plaintext', () => {
    const store = new SessionStore()

    store.saveSession(session)

    expect(storeState.get('session')).toEqual({
      encryptedToken: Buffer.from('encrypted:secret-token').toString('base64'),
      tokenStorage: 'safeStorage',
      userId: session.userId,
      user: session.user,
      expiresAt: session.expiresAt,
    })
    expect(JSON.stringify(storeState.get('session'))).not.toContain(
      'secret-token',
    )
    expect(store.getSession()).toEqual(session)
  })

  it('migrates legacy plaintext token sessions on read', () => {
    storeState.set('session', session)
    const store = new SessionStore()

    expect(store.getSession()).toEqual(session)

    expect(JSON.stringify(storeState.get('session'))).not.toContain(
      'secret-token',
    )
    expect(storeState.get('session')).toMatchObject({
      tokenStorage: 'safeStorage',
      userId: session.userId,
    })
  })

  it('keeps tokens memory-only when safe storage is unavailable', () => {
    safeStorageMock.isEncryptionAvailable.mockReturnValue(false)
    const store = new SessionStore()

    store.saveSession(session)

    expect(storeState.get('session')).toEqual({
      userId: session.userId,
      user: session.user,
      expiresAt: session.expiresAt,
    })
    expect(store.getSession()).toEqual(session)
  })
})
