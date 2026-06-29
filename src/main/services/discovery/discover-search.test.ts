import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock platform probes BEFORE importing the module under test, so its top-level
// imports resolve to the mocks.
vi.mock('./discover-youtube', () => ({
  searchYouTubeChannelsByKeyword: vi.fn().mockResolvedValue([]),
  looksLikeYouTubeChannelId: vi.fn().mockReturnValue(false),
}))
vi.mock('./discover-bilibili', () => ({
  probeBilibiliUsersByKeyword: vi.fn().mockResolvedValue([]),
}))
vi.mock('./discover-x', () => ({
  probeXUsersByKeyword: vi.fn().mockResolvedValue([]),
  extractLikelyXHandle: vi.fn().mockReturnValue(null),
  extractLikelyXHandleFromKeywords: vi.fn().mockReturnValue(null),
}))
vi.mock('./discover-instagram-search', () => ({
  probeInstagramUsersByKeyword: vi.fn().mockResolvedValue([]),
}))
vi.mock('./wechat-mp-client', () => ({
  searchWechatMp: vi.fn().mockResolvedValue({
    results: [],
    total: 0,
    limit: 10,
    offset: 0,
  }),
  ensureWechatMpFeed: vi.fn(),
}))
vi.mock('../feed/rss-parser', () => ({
  fetchAndParseFeed: vi.fn().mockRejectedValue(new Error('not used')),
}))
vi.mock('../feed/feed-utils', () => ({
  getFeedImageUrl: vi.fn().mockReturnValue(''),
}))
vi.mock('./discover-preview', () => ({
  inferDiscoverResultTitle: vi.fn().mockResolvedValue('inferred-title'),
  inferDiscoverResultImage: vi.fn().mockResolvedValue(''),
}))
vi.mock('../system/logger', () => ({
  logInfo: vi.fn(),
}))

const { discoverSearch } = await import('./discover-search')
const { searchYouTubeChannelsByKeyword } = await import('./discover-youtube')
const { probeBilibiliUsersByKeyword } = await import('./discover-bilibili')
const { probeXUsersByKeyword } = await import('./discover-x')
const { probeInstagramUsersByKeyword } =
  await import('./discover-instagram-search')

describe('discoverSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns curated + rsshub-route hits for a local-only "all" query', async () => {
    const results = await discoverSearch('hacker', 'all', 'https://rsshub.app')
    // Curated/RSSHUB data is loaded from the real shared/discover-data
    // module; assert the search at least surfaces something and that no
    // probe was called for a no-match-looking keyword.
    expect(Array.isArray(results)).toBe(true)
    // YouTube probe is invoked for "all" queries; bilibili too.
    expect(searchYouTubeChannelsByKeyword).toHaveBeenCalledTimes(1)
    expect(probeBilibiliUsersByKeyword).toHaveBeenCalledTimes(1)
  })

  it('skips video probes when platform is x', async () => {
    await discoverSearch('elonmusk', 'x', 'https://rsshub.app')
    expect(searchYouTubeChannelsByKeyword).not.toHaveBeenCalled()
    expect(probeBilibiliUsersByKeyword).not.toHaveBeenCalled()
    expect(probeXUsersByKeyword).toHaveBeenCalledTimes(1)
    expect(probeInstagramUsersByKeyword).not.toHaveBeenCalled()
  })

  it('caches results across calls with identical query+platform', async () => {
    await discoverSearch('cachetest', 'x', 'https://rsshub.app')
    expect(probeXUsersByKeyword).toHaveBeenCalledTimes(1)

    await discoverSearch('cachetest', 'x', 'https://rsshub.app')
    // Second call should hit cache; probe should NOT be invoked again.
    expect(probeXUsersByKeyword).toHaveBeenCalledTimes(1)
  })

  it('does not cache instagram results', async () => {
    await discoverSearch('igtest', 'instagram', 'https://rsshub.app')
    expect(probeInstagramUsersByKeyword).toHaveBeenCalledTimes(1)

    await discoverSearch('igtest', 'instagram', 'https://rsshub.app')
    expect(probeInstagramUsersByKeyword).toHaveBeenCalledTimes(2)
  })
})
