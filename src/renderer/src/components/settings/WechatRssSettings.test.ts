import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  hasPersistedAuthorization,
  resolveWechatAuthorizationState,
} from './WechatRssSettings'

function stubLocalStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  const localStorage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key)
    }),
  }
  vi.stubGlobal('localStorage', localStorage)
  return { localStorage, values }
}

describe('WechatRssSettings authorization state', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the page authorized when local success state exists but server status is not restored yet', () => {
    expect(
      resolveWechatAuthorizationState({
        serverIsLoggedIn: false,
        hasPersistedAuthorization: true,
      }),
    ).toBe(true)
  })

  it('uses the server status when no local success state exists', () => {
    expect(
      resolveWechatAuthorizationState({
        serverIsLoggedIn: false,
        hasPersistedAuthorization: false,
      }),
    ).toBe(false)
    expect(
      resolveWechatAuthorizationState({
        serverIsLoggedIn: true,
        hasPersistedAuthorization: false,
      }),
    ).toBe(true)
  })

  it('does not treat the legacy token key as local authorization', () => {
    const { localStorage, values } = stubLocalStorage({
      'livo-wechat-mp-token': 'legacy-secret-token',
    })

    expect(hasPersistedAuthorization()).toBe(false)
    expect(values.has('livo-wechat-mp-token')).toBe(false)
    expect(localStorage.removeItem).toHaveBeenCalledWith('livo-wechat-mp-token')
  })

  it('keeps the logged-in marker and removes the legacy token during migration', () => {
    const { values } = stubLocalStorage({
      'livo-wechat-mp-token': 'legacy-secret-token',
      'livo-wechat-mp-logged-in': '1',
    })

    expect(hasPersistedAuthorization()).toBe(true)
    expect(values.has('livo-wechat-mp-token')).toBe(false)
    expect(values.get('livo-wechat-mp-logged-in')).toBe('1')
  })
})
