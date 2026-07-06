import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assertNetworkFetchTarget,
  classifyNetworkFetchUrl,
} from './network-url-policy'

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}))

vi.mock('dns/promises', () => ({
  lookup: mocks.lookup,
}))

describe('network-url-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    ['http://[::ffff:127.0.0.1]/feed.xml', 'loopback'],
    ['http://0.0.0.0/feed.xml', 'private-network'],
    ['http://169.254.169.254/latest/meta-data', 'private-network'],
    ['http://10.0.0.1/feed.xml', 'private-network'],
    ['http://192.168.0.1/feed.xml', 'private-network'],
    ['http://[::ffff:10.0.0.1]/feed.xml', 'private-network'],
    ['http://[::ffff:c0a8:0001]/feed.xml', 'private-network'],
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

  it('returns a pinned public address for allowed network fetch targets', async () => {
    mocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ])

    const target = await assertNetworkFetchTarget(
      ' https://example.com/feed.xml ',
    )

    expect(target).toEqual({
      url: 'https://example.com/feed.xml',
      hostname: 'example.com',
      resolvedAddresses: [
        '93.184.216.34',
        '2606:2800:220:1:248:1893:25c8:1946',
      ],
      pinnedAddress: '93.184.216.34',
    })
  })

  it('blocks hostnames when any resolved address is private', async () => {
    mocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ])

    await expect(
      assertNetworkFetchTarget('https://mixed.example/feed.xml'),
    ).rejects.toThrow('private-network')
  })

  it('blocks targets that resolve to no address', async () => {
    mocks.lookup.mockResolvedValue([])

    await expect(
      assertNetworkFetchTarget('https://empty.example/feed.xml'),
    ).rejects.toThrow('missing-address')
  })
})
