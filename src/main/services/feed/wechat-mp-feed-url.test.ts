import { afterEach, describe, expect, it } from 'vitest'
import { rewriteWechatMpFeedUrlToBackendProxy } from './wechat-mp-feed-url'

const originalServerBaseUrl = process.env.LIVO_SERVER_BASE_URL

afterEach(() => {
  if (originalServerBaseUrl === undefined) {
    delete process.env.LIVO_SERVER_BASE_URL
  } else {
    process.env.LIVO_SERVER_BASE_URL = originalServerBaseUrl
  }
})

describe('rewriteWechatMpFeedUrlToBackendProxy', () => {
  it('rewrites legacy upstream WeChat MP feed URLs to the Livo backend proxy', () => {
    process.env.LIVO_SERVER_BASE_URL = 'https://api.example.com/'

    expect(
      rewriteWechatMpFeedUrlToBackendProxy(
        'https://wechat-rss.example/feed/MP_WXS_gh_12345.xml',
      ),
    ).toBe('https://api.example.com/api/wechat-rss/feed/MP_WXS_gh_12345.xml')
  })

  it('leaves non-WeChat feed URLs unchanged', () => {
    expect(
      rewriteWechatMpFeedUrlToBackendProxy('https://example.com/feed.xml'),
    ).toBe('https://example.com/feed.xml')
  })
})
