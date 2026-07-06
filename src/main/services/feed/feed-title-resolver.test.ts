import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  assertNetworkFetchUrl: vi.fn(async (url: string) => {
    if (url.includes('127.0.0.1') || url.includes('169.254.169.254')) {
      throw new Error('blocked')
    }
    return url
  }),
}))

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      fetch: mocks.fetch,
    },
  },
}))

vi.mock('../system/network-url-policy', () => ({
  assertNetworkFetchUrl: mocks.assertNetworkFetchUrl,
}))

import { resolveFeedTitleFallback } from './feed-title-resolver'

describe('resolveFeedTitleFallback', () => {
  beforeEach(() => {
    mocks.fetch.mockReset()
    mocks.assertNetworkFetchUrl.mockReset()
    mocks.assertNetworkFetchUrl.mockImplementation(async (url: string) => {
      if (url.includes('127.0.0.1') || url.includes('169.254.169.254')) {
        throw new Error('blocked')
      }
      return url
    })
  })

  it('extracts a generic RSS title through the guarded fetch helper', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        '<rss><channel><title>Example Feed</title></channel></rss>',
        {
          status: 200,
          headers: { 'content-type': 'application/rss+xml' },
        },
      ),
    )

    await expect(
      resolveFeedTitleFallback('https://example.com/feed.xml'),
    ).resolves.toBe('Example Feed')

    expect(mocks.assertNetworkFetchUrl).toHaveBeenCalledWith(
      'https://example.com/feed.xml',
    )
    expect(mocks.fetch.mock.calls[0][1]?.redirect).toBe('manual')
  })

  it('blocks loopback feed title fetches before calling fetch', async () => {
    await expect(
      resolveFeedTitleFallback('http://127.0.0.1/feed.xml'),
    ).resolves.toBeUndefined()

    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('does not follow redirects to loopback targets', async () => {
    mocks.fetch.mockResolvedValue(
      new Response('', {
        status: 302,
        headers: { location: 'http://127.0.0.1/feed.xml' },
      }),
    )

    await expect(
      resolveFeedTitleFallback('https://example.com/feed.xml'),
    ).resolves.toBeUndefined()

    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.assertNetworkFetchUrl.mock.calls.map(([url]) => url)).toEqual([
      'https://example.com/feed.xml',
      'http://127.0.0.1/feed.xml',
    ])
  })

  it('rejects oversized title responses', async () => {
    mocks.fetch.mockResolvedValue(
      new Response('<rss><channel><title>Huge Feed</title></channel></rss>', {
        status: 200,
        headers: { 'content-length': String(2 * 1024 * 1024) },
      }),
    )

    await expect(
      resolveFeedTitleFallback('https://example.com/feed.xml'),
    ).resolves.toBeUndefined()
  })

  it('resolves Bilibili names through bounded JSON fetches', async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ code: 0, data: { card: { name: 'Alice' } } }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )

    await expect(
      resolveFeedTitleFallback('https://rsshub.app/bilibili/user/dynamic/123'),
    ).resolves.toBe('Alice (Bilibili)')
  })
})
