import { describe, expect, it, vi } from 'vitest'

// Electron is not available in the Node test environment; the core module only
// touches `session.defaultSession.fetch` lazily inside the default fetch, which
// we never exercise here (every test injects a fake fetch instead).
vi.mock('electron', () => ({ session: { defaultSession: { fetch: vi.fn() } } }))

// The SSRF guard reaches into Electron's net stack; stub it to a pass-through so
// the core can be tested without the real network policy.
vi.mock('./discover-url-policy', () => ({
  assertPublicDiscoveryUrl: (url: string) => Promise.resolve(url),
}))

import {
  type DiscoveryFetch,
  type DiscoveryFetchResponse,
  type ScoredCandidate,
  DISCOVERY_CHROME_UA,
  dedupeScoreAndSort,
  discoveryFetch,
  extractOgMeta,
  formatFollowerLabel,
  normalizeFollowerLabel,
} from './platform-search'
import { probeBilibiliUsersByKeyword } from './discover-bilibili'

function fakeResponse(
  body: string | object,
  ok = true,
  status = 200,
): DiscoveryFetchResponse {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok,
    status,
    text: () => Promise.resolve(text),
    json: () =>
      Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
  }
}

describe('normalizeFollowerLabel (KMB parsing)', () => {
  it('canonicalizes number-first labels', () => {
    expect(normalizeFollowerLabel('1.2M followers')).toBe('1.2M followers')
    expect(normalizeFollowerLabel('219.3M Followers')).toBe('219.3M followers')
    expect(normalizeFollowerLabel('Followers: 12.5K')).toBe('12.5K followers')
  })

  it('ignores zero / missing counts', () => {
    expect(normalizeFollowerLabel('0 followers')).toBeUndefined()
    expect(normalizeFollowerLabel('no follower data')).toBeUndefined()
    expect(normalizeFollowerLabel('')).toBeUndefined()
  })
})

describe('formatFollowerLabel (numeric -> KMB + suffix)', () => {
  it('formats with a localized suffix', () => {
    expect(formatFollowerLabel(1_200_000, ' followers')).toBe('1.2M followers')
    expect(formatFollowerLabel(34_000, ' 粉丝')).toBe('34K 粉丝')
    expect(formatFollowerLabel('5000', ' 粉丝')).toBe('5K 粉丝')
  })

  it('rejects non-finite or negative counts', () => {
    expect(formatFollowerLabel(undefined, ' followers')).toBeUndefined()
    expect(formatFollowerLabel(-1, ' followers')).toBeUndefined()
    expect(formatFollowerLabel('not-a-number', ' followers')).toBeUndefined()
  })
})

describe('extractOgMeta (og-meta scraping)', () => {
  it('reads property-ordered and content-first meta tags', () => {
    expect(
      extractOgMeta(
        '<meta property="og:image" content="https://cdn/x.jpg">',
        'og:image',
      ),
    ).toBe('https://cdn/x.jpg')
    expect(
      extractOgMeta(
        '<meta content="Jane (@jane) - X" property="og:title">',
        'og:title',
      ),
    ).toBe('Jane (@jane) - X')
  })

  it('falls back to name-based meta and returns empty when absent', () => {
    expect(
      extractOgMeta(
        '<meta name="twitter:image" content="https://cdn/a.png">',
        'twitter:image',
      ),
    ).toBe('https://cdn/a.png')
    expect(extractOgMeta('<html></html>', 'og:image')).toBe('')
  })
})

describe('dedupeScoreAndSort (dedupe + scoring + slice)', () => {
  const base = { title: '', description: '', image: '', feedUrl: '' }

  it('dedupes by key, sorts by descending score, and slices', () => {
    const candidates: ScoredCandidate[] = [
      { ...base, feedUrl: 'a', dedupeKey: 'a', score: 100 },
      { ...base, feedUrl: 'b', dedupeKey: 'b', score: 300 },
      { ...base, feedUrl: 'a2', dedupeKey: 'a', score: 999 }, // dup key dropped
      { ...base, feedUrl: 'c', dedupeKey: 'c', score: 200 },
    ]
    const out = dedupeScoreAndSort(candidates, 2)
    expect(out.map((c) => c.feedUrl)).toEqual(['b', 'c'])
    // Internal bookkeeping fields are stripped from the output.
    expect(out[0]).not.toHaveProperty('dedupeKey')
    expect(out[0]).not.toHaveProperty('score')
  })

  it('is stable for equal scores (preserves input order)', () => {
    const candidates: ScoredCandidate[] = [
      { ...base, feedUrl: 'x', dedupeKey: 'x', score: 5 },
      { ...base, feedUrl: 'y', dedupeKey: 'y', score: 5 },
      { ...base, feedUrl: 'z', dedupeKey: 'z', score: 5 },
    ]
    expect(dedupeScoreAndSort(candidates, 10).map((c) => c.feedUrl)).toEqual([
      'x',
      'y',
      'z',
    ])
  })
})

describe('discoveryFetch (injected fetch + shared headers)', () => {
  it('sends the Chrome UA and merges header overrides', async () => {
    const fetchImpl = vi.fn<DiscoveryFetch>(() =>
      Promise.resolve(fakeResponse('ok')),
    )
    await discoveryFetch('https://example.com', {
      fetchImpl,
      headers: { Accept: 'application/json' },
    })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.headers?.['User-Agent']).toBe(DISCOVERY_CHROME_UA)
    expect(init?.headers?.Accept).toBe('application/json')
  })

  it('returns undefined instead of throwing on fetch failure', async () => {
    const fetchImpl = vi.fn<DiscoveryFetch>(() =>
      Promise.reject(new Error('network down')),
    )
    await expect(
      discoveryFetch('https://example.com', { fetchImpl }),
    ).resolves.toBeUndefined()
  })
})

describe('discover-bilibili adapter end-to-end (canned fetch)', () => {
  it('maps the search API response into ranked candidates', async () => {
    const fakeApi = {
      code: 0,
      data: {
        result: [
          {
            mid: 111,
            uname: 'Alice',
            usign: 'hello',
            upic: 'https://i/alice.jpg',
            fans: 1_200_000,
          },
          {
            mid: 222,
            uname: 'Alice Backup',
            usign: 'alice fan',
            upic: '',
            fans: 'not-a-number',
          },
          // Duplicate mid should be deduped by the core.
          { mid: 111, uname: 'Alice Dup', usign: 'dup', fans: 5 },
          // No keyword match -> score 0 -> dropped.
          { mid: 333, uname: 'Bob', usign: 'unrelated', fans: 10 },
        ],
      },
    }
    const fetchImpl = vi.fn<DiscoveryFetch>(() =>
      Promise.resolve(fakeResponse(fakeApi)),
    )

    const out = await probeBilibiliUsersByKeyword(
      'alice',
      'https://rsshub.app',
      fetchImpl,
    )

    // Exact-name match ("Alice") outranks the partial match ("Alice Backup");
    // "Bob" is filtered out and the duplicate mid is collapsed.
    expect(out.map((c) => c.uid)).toEqual(['111', '222'])
    expect(out[0]).toEqual({
      uid: '111',
      title: 'Alice - Bilibili',
      description: 'hello',
      image: 'https://i/alice.jpg',
      feedUrl: 'https://rsshub.app/bilibili/user/dynamic/111',
      followers: '1.2M 粉丝',
    })
    // A non-numeric fans value yields no follower label.
    expect(out[1].followers).toBeUndefined()
  })

  it('returns [] when the query is blank', async () => {
    const fetchImpl = vi.fn<DiscoveryFetch>(() =>
      Promise.resolve(fakeResponse({ code: 0, data: { result: [] } })),
    )
    expect(
      await probeBilibiliUsersByKeyword('  ', 'https://r', fetchImpl),
    ).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
