import { describe, expect, it } from 'vitest'
import { classifyNetworkFetchUrl } from './network-url-policy'

describe('network-url-policy', () => {
  it('blocks credential-bearing network URLs', async () => {
    const result = await classifyNetworkFetchUrl(
      'https://user:pass@example.com/feed.xml',
    )

    expect(result.allowed).toBe(false)
    expect(result.blockedReason).toBe('credentials')
  })

  it.each([
    ['http://localhost:1200/feed.xml', 'loopback'],
    ['http://127.0.0.1/feed.xml', 'loopback'],
    ['http://[::1]/feed.xml', 'loopback'],
    ['http://0.0.0.0/feed.xml', 'private-network'],
    ['http://169.254.169.254/latest/meta-data', 'private-network'],
    ['http://10.0.0.1/feed.xml', 'private-network'],
    ['http://192.168.0.1/feed.xml', 'private-network'],
  ])('blocks dangerous public-fetch target %s', async (url, reason) => {
    const result = await classifyNetworkFetchUrl(url)

    expect(result.allowed).toBe(false)
    expect(result.blockedReason).toBe(reason)
  })

  it('normalizes bracketed IPv6 literals before DNS resolution', async () => {
    const result = await classifyNetworkFetchUrl('http://[::1]/feed.xml')

    expect(result.allowed).toBe(false)
    expect(result.blockedReason).toBe('loopback')
    expect(result.hostname).toBe('::1')
    expect(result.resolvedAddresses).toEqual(['::1'])
  })

  it('allows local RSSHub only when explicitly requested', async () => {
    const result = await classifyNetworkFetchUrl(
      'http://localhost:1200/twitter/user/rss',
      {
        allowLoopback: true,
        allowPrivateNetwork: true,
      },
    )

    expect(result.allowed).toBe(true)
  })
})
