import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))
vi.mock('../ipc/register-channel', () => ({ registerChannel: vi.fn() }))
vi.mock('../services/backend/backend-config', () => ({
  getBackendBaseUrl: () => 'http://127.0.0.1:8787',
}))

import {
  buildCookieString,
  extractTokenFromCookies,
  extractTokenFromUrl,
  getWechatMpCookieLookupUrls,
  isWechatMpAuthenticatedUrl,
} from './wechat-mp-handlers'

function cookie(input: {
  name: string
  value: string
  domain?: string
  path?: string
}): Electron.Cookie {
  return {
    name: input.name,
    value: input.value,
    domain: input.domain || 'mp.weixin.qq.com',
    path: input.path || '/',
    hostOnly: false,
    secure: true,
    httpOnly: false,
    session: false,
  } as Electron.Cookie
}

describe('wechat mp login helpers', () => {
  it('treats WeChat MP validate URLs with token as authenticated', () => {
    const url =
      'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=validate&token=wx-token&lang=zh_CN'

    expect(isWechatMpAuthenticatedUrl(url)).toBe(true)
    expect(extractTokenFromUrl(url)).toBe('wx-token')
  })

  it('treats known console pages as authenticated', () => {
    expect(
      isWechatMpAuthenticatedUrl(
        'https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN',
      ),
    ).toBe(true)
    expect(
      isWechatMpAuthenticatedUrl(
        'https://mp.weixin.qq.com/cgi-bin/appmsgpublish?sub=list',
      ),
    ).toBe(true)
  })

  it('does not treat the login root or another origin as authenticated', () => {
    expect(isWechatMpAuthenticatedUrl('https://mp.weixin.qq.com/')).toBe(false)
    expect(
      isWechatMpAuthenticatedUrl(
        'https://example.com/cgi-bin/home?token=wx-token',
      ),
    ).toBe(false)
  })

  it('extracts token from exact and token-like cookie names', () => {
    expect(
      extractTokenFromCookies([
        cookie({ name: 'sessionid', value: 'session' }),
        cookie({ name: 'token', value: 'exact-token' }),
      ]),
    ).toBe('exact-token')

    expect(
      extractTokenFromCookies([
        cookie({ name: 'sessionid', value: 'session' }),
        cookie({ name: 'wx_token', value: 'fallback-token' }),
      ]),
    ).toBe('fallback-token')
  })

  it('queries cookies for both root and current WeChat URL', () => {
    const currentUrl =
      'https://mp.weixin.qq.com/cgi-bin/bizlogin?action=validate&token=wx-token'

    expect(getWechatMpCookieLookupUrls(currentUrl)).toEqual([
      'https://mp.weixin.qq.com/',
      currentUrl,
    ])
  })

  it('serializes cookies for backend forwarding', () => {
    expect(
      buildCookieString([
        cookie({ name: 'token', value: 'wx-token' }),
        cookie({ name: 'slave_sid', value: 'sid' }),
      ]),
    ).toBe('token=wx-token; slave_sid=sid')
  })
})
