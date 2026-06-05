import { describe, it, expect } from 'vitest'
import {
  inferDiscoverFeedViewFromUrl,
  canonicalizeDiscoverRoute,
  extractInstagramUsername,
  findExistingFeed,
  resolveSubscriptionTarget,
  getWarmupStrategy,
  shouldUseSocialBackgroundRefresh,
  pickBestCandidate,
} from './subscription-intake'
import { FeedViewType } from './types'
import type { Feed } from './types'

describe('inferDiscoverFeedViewFromUrl', () => {
  it('returns SocialMedia for twitter user route', () => {
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/twitter/user/openai'),
    ).toBe(FeedViewType.SocialMedia)
  })

  it('returns SocialMedia for x.com user route', () => {
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/x/user/openai'),
    ).toBe(FeedViewType.SocialMedia)
  })

  it('returns Videos for bilibili video route', () => {
    expect(
      inferDiscoverFeedViewFromUrl(
        'https://rsshub.app/bilibili/user/video/12345',
      ),
    ).toBe(FeedViewType.Videos)
  })

  it('returns SocialMedia for bilibili dynamic route', () => {
    expect(
      inferDiscoverFeedViewFromUrl(
        'https://rsshub.app/bilibili/user/dynamic/12345',
      ),
    ).toBe(FeedViewType.SocialMedia)
  })

  it('returns Videos for youtube route', () => {
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/youtube/channel/UC_x5'),
    ).toBe(FeedViewType.Videos)
  })

  it('returns Pictures for instagram route', () => {
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/instagram/user/openai'),
    ).toBe(FeedViewType.Pictures)
  })

  it('returns Pictures for picnob mirror', () => {
    expect(
      inferDiscoverFeedViewFromUrl('https://rsshub.app/picnob/user/test'),
    ).toBe(FeedViewType.Pictures)
  })

  it('returns Articles for generic RSS feed', () => {
    expect(inferDiscoverFeedViewFromUrl('https://example.com/feed.xml')).toBe(
      FeedViewType.Articles,
    )
  })
})

describe('canonicalizeDiscoverRoute', () => {
  it('extracts route from rsshub:// URL', () => {
    expect(canonicalizeDiscoverRoute('rsshub://instagram/user/test')).toBe(
      'instagram/user/test',
    )
  })

  it('extracts route from https URL', () => {
    expect(
      canonicalizeDiscoverRoute('https://rsshub.app/instagram/user/test'),
    ).toBe('instagram/user/test')
  })

  it('preserves picnob route as-is', () => {
    expect(
      canonicalizeDiscoverRoute('https://rsshub.app/picnob/user/test'),
    ).toBe('picnob/user/test')
  })

  it('normalizes twitter user case', () => {
    expect(
      canonicalizeDiscoverRoute('https://rsshub.app/twitter/user/OpenAI'),
    ).toBe('twitter/user/openai')
  })

  it('strips limit param for instagram/twitter', () => {
    expect(
      canonicalizeDiscoverRoute(
        'https://rsshub.app/instagram/user/test?limit=100',
      ),
    ).toBe('instagram/user/test')
  })

  it('strips limit param for picnob', () => {
    expect(
      canonicalizeDiscoverRoute(
        'https://rsshub.app/picnob/user/test?limit=100',
      ),
    ).toBe('picnob/user/test')
  })

  it('returns empty for empty input', () => {
    expect(canonicalizeDiscoverRoute('')).toBe('')
  })
})

describe('extractInstagramUsername', () => {
  it('extracts from instagram user route', () => {
    expect(
      extractInstagramUsername('https://rsshub.app/instagram/user/testuser'),
    ).toBe('testuser')
  })

  it('extracts from picnob user route', () => {
    expect(
      extractInstagramUsername('https://rsshub.app/picnob/user/testuser'),
    ).toBe('testuser')
  })

  it('strips @ prefix', () => {
    expect(
      extractInstagramUsername('https://rsshub.app/instagram/user/@testuser'),
    ).toBe('testuser')
  })

  it('decodes URI components', () => {
    expect(
      extractInstagramUsername(
        'https://rsshub.app/instagram/user/%E4%B8%AD%E6%96%87',
      ),
    ).toBe('中文')
  })

  it('returns null for non-instagram URL', () => {
    expect(
      extractInstagramUsername('https://rsshub.app/youtube/channel/UC123'),
    ).toBeNull()
  })
})

describe('findExistingFeed', () => {
  const feeds: Feed[] = [
    {
      id: '1',
      url: 'https://rsshub.app/instagram/user/alice',
      siteUrl: 'https://instagram.com/alice',
      category: '',
      view: FeedViewType.Pictures,
      title: 'Alice',
      errorCount: 0,
      createdAt: 0,
    },
    {
      id: '2',
      url: 'https://rsshub.app/twitter/user/bob',
      siteUrl: '',
      category: 'Social',
      view: FeedViewType.SocialMedia,
      title: 'Bob',
      errorCount: 0,
      createdAt: 0,
    },
    {
      id: '3',
      url: 'https://rsshub.app/youtube/channel/UC123',
      siteUrl: '',
      category: 'Recommended',
      view: FeedViewType.Videos,
      title: 'Recommended Channel',
      errorCount: 0,
      createdAt: 0,
    },
  ]

  it('finds feed by exact URL match', () => {
    const result = findExistingFeed(
      feeds,
      'https://rsshub.app/twitter/user/bob',
    )
    expect(result).toBeDefined()
    expect(result!.id).toBe('2')
  })

  it('finds feed by siteUrl match', () => {
    const result = findExistingFeed(
      feeds,
      'https://instagram.com/alice',
      'https://instagram.com/alice',
    )
    expect(result).toBeDefined()
    expect(result!.id).toBe('1')
  })

  it('finds feed by canonical route match', () => {
    // Different RSSHub instance, same route
    const result = findExistingFeed(
      feeds,
      'https://other-rsshub.app/instagram/user/alice',
    )
    expect(result).toBeDefined()
    expect(result!.id).toBe('1')
  })

  it('finds feed by Instagram username fallback', () => {
    // Different instance, different mirror, same username
    const result = findExistingFeed(
      feeds,
      'https://rsshub.app/picnob/user/alice',
    )
    expect(result).toBeDefined()
    expect(result!.id).toBe('1')
  })

  it('skips Recommended feeds', () => {
    expect(
      findExistingFeed(feeds, 'https://rsshub.app/youtube/channel/UC123'),
    ).toBeUndefined()
  })

  it('returns undefined when no match', () => {
    expect(
      findExistingFeed(feeds, 'https://rsshub.app/youtube/channel/UC999'),
    ).toBeUndefined()
  })
})

describe('pickBestCandidate', () => {
  const candidates = [
    {
      feedUrl: 'https://rsshub.app/bilibili/user/video/123',
      title: 'Video',
      view: FeedViewType.Videos,
    },
    {
      feedUrl: 'https://rsshub.app/bilibili/user/dynamic/123',
      title: 'Dynamic',
      view: FeedViewType.SocialMedia,
    },
  ]

  it('returns first candidate when no preferred view', () => {
    expect(pickBestCandidate(candidates)?.feedUrl).toBe(
      'https://rsshub.app/bilibili/user/video/123',
    )
  })

  it('returns matching candidate for preferred view', () => {
    expect(
      pickBestCandidate(candidates, FeedViewType.SocialMedia)?.feedUrl,
    ).toBe('https://rsshub.app/bilibili/user/dynamic/123')
  })

  it('falls back to first when no view match', () => {
    expect(pickBestCandidate(candidates, FeedViewType.Pictures)?.feedUrl).toBe(
      'https://rsshub.app/bilibili/user/video/123',
    )
  })

  it('returns undefined for empty candidates', () => {
    expect(pickBestCandidate([])).toBeUndefined()
  })
})

describe('resolveSubscriptionTarget', () => {
  it('resolves plain RSS URL directly', () => {
    const result = resolveSubscriptionTarget('https://example.com/feed.xml', {
      rsshubInstance: 'https://rsshub.app',
    })
    expect(result.target.feedUrl).toBe('https://example.com/feed.xml')
    expect(result.target.view).toBe(FeedViewType.Articles)
  })

  it('normalizes rsshub:// to full URL', () => {
    const result = resolveSubscriptionTarget('rsshub://twitter/user/openai', {
      rsshubInstance: 'https://rsshub.app',
    })
    expect(result.target.feedUrl).toContain('twitter/user/openai')
    expect(result.target.view).toBe(FeedViewType.SocialMedia)
  })

  it('uses pre-resolved candidates when provided', () => {
    const result = resolveSubscriptionTarget('https://instagram.com/alice', {
      rsshubInstance: 'https://rsshub.app',
      resolvedCandidates: [
        {
          feedUrl: 'https://rsshub.app/instagram/user/alice',
          title: 'Alice',
          view: FeedViewType.Pictures,
        },
      ],
    })
    expect(result.target.feedUrl).toBe(
      'https://rsshub.app/instagram/user/alice',
    )
    expect(result.target.title).toBe('Alice')
    expect(result.target.view).toBe(FeedViewType.Pictures)
  })

  it('finds existing feed in provided feeds array', () => {
    const feeds: Feed[] = [
      {
        id: '1',
        url: 'https://rsshub.app/twitter/user/openai',
        category: '',
        view: FeedViewType.SocialMedia,
        title: 'OpenAI',
        errorCount: 0,
        createdAt: 0,
      },
    ]
    const result = resolveSubscriptionTarget(
      'https://rsshub.app/twitter/user/openai',
      { rsshubInstance: 'https://rsshub.app', feeds },
    )
    expect(result.existingFeed).toBeDefined()
    expect(result.existingFeed!.id).toBe('1')
  })
})

describe('getWarmupStrategy', () => {
  it('returns deferred-queue for social media view', () => {
    expect(
      getWarmupStrategy('https://example.com', FeedViewType.SocialMedia),
    ).toBe('deferred-queue')
  })

  it('returns deferred-queue for pictures view', () => {
    expect(
      getWarmupStrategy('https://example.com', FeedViewType.Pictures),
    ).toBe('deferred-queue')
  })

  it('returns deferred-queue for instagram user URL', () => {
    expect(
      getWarmupStrategy(
        'https://rsshub.app/instagram/user/test',
        FeedViewType.Articles,
      ),
    ).toBe('deferred-queue')
  })

  it('returns sync-bootstrap for regular articles', () => {
    expect(
      getWarmupStrategy('https://example.com/feed.xml', FeedViewType.Articles),
    ).toBe('sync-bootstrap')
  })
})

describe('shouldUseSocialBackgroundRefresh', () => {
  it('returns true for social media view', () => {
    expect(
      shouldUseSocialBackgroundRefresh(
        'https://example.com',
        FeedViewType.SocialMedia,
      ),
    ).toBe(true)
  })

  it('returns true for instagram user URL', () => {
    expect(
      shouldUseSocialBackgroundRefresh(
        'https://rsshub.app/instagram/user/test',
        FeedViewType.Articles,
      ),
    ).toBe(true)
  })

  it('returns false for regular article feed', () => {
    expect(
      shouldUseSocialBackgroundRefresh(
        'https://example.com/feed.xml',
        FeedViewType.Articles,
      ),
    ).toBe(false)
  })
})
