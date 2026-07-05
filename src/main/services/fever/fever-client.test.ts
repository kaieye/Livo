import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFeverClient } from './fever-client'

describe('createFeverClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes a FreshRSS root URL before making Fever requests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ auth: 1, status: 1, groups: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createFeverClient(
      'https://rss.example.com/FreshRSS',
      'alice',
      'api-password',
    )

    await expect(client.verify()).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rss.example.com/FreshRSS/api/fever.php?api&groups=1',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          api_key: createHash('md5').update('alice:api-password').digest('hex'),
        }).toString(),
      }),
    )
  })
})
