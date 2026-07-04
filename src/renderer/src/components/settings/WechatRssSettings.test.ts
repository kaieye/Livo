import { describe, expect, it } from 'vitest'

import { resolveWechatAuthorizationState } from './WechatRssSettings'

describe('WechatRssSettings authorization state', () => {
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
})
