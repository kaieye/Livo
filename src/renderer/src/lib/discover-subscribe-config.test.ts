import { describe, expect, it } from 'vitest'
import { FeedViewType, type FeedWithCount } from '../../../shared/types'
import {
  buildDiscoverCategoryOptions,
  canonicalizeDiscoverRoute,
  feedMatchesDiscoverTarget,
  findDiscoverSubscribeFeed,
  parseDiscoverSubscribeTarget,
  resolveDiscoverSubscribeUrl,
} from './discover-subscribe-config'

function feed(
  overrides: Partial<FeedWithCount> & Pick<FeedWithCount, 'id' | 'url'>,
): FeedWithCount {
  return {
    ...overrides,
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    url: overrides.url,
    view: overrides.view ?? FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1,
    unreadCount: 0,
  }
}

describe('discover-subscribe-config', () => {
  it('parses route search params without coercing missing view to articles', () => {
    expect(parseDiscoverSubscribeTarget('?url=https%3A%2F%2Fx.test')).toEqual({
      url: 'https://x.test',
      feedId: undefined,
      title: undefined,
      siteUrl: undefined,
      imageUrl: undefined,
      description: undefined,
      category: undefined,
      view: undefined,
      metadata: {
        fakeId: undefined,
        source: undefined,
        requiresLogin: undefined,
      },
    })
  })

  it('canonicalizes social routes so mirrored URLs match existing feeds', () => {
    expect(
      canonicalizeDiscoverRoute('https://rsshub.app/x/user/OpenAI?limit=120'),
    ).toBe('twitter/user/openai')
    expect(
      canonicalizeDiscoverRoute('rsshub://picnob.info/user/openai?limit=100'),
    ).toBe('picnob.info/user/openai')
  })

  it('matches an existing feed by route identity', () => {
    const existing = feed({
      id: 'feed-1',
      url: 'rsshub://twitter/user/openai?limit=120',
      view: FeedViewType.SocialMedia,
    })

    expect(
      feedMatchesDiscoverTarget(
        existing,
        {
          url: 'https://rsshub.example.com/x/user/OpenAI?limit=20',
          view: FeedViewType.SocialMedia,
        },
        FeedViewType.SocialMedia,
      ),
    ).toBe(true)
  })

  it('finds by explicit feed id before URL matching', () => {
    const feeds = [
      feed({ id: 'a', url: 'https://a.test/rss.xml' }),
      feed({ id: 'b', url: 'https://b.test/rss.xml' }),
    ]

    expect(
      findDiscoverSubscribeFeed(feeds, {
        feedId: 'b',
        url: 'https://a.test/rss.xml',
      })?.id,
    ).toBe('b')
  })

  it('remaps bilibili user feeds when the user changes view type', () => {
    expect(
      resolveDiscoverSubscribeUrl(
        { url: 'https://rsshub.app/bilibili/user/video/42' },
        FeedViewType.SocialMedia,
      ),
    ).toBe('https://rsshub.app/bilibili/user/dynamic/42')
  })

  it('builds category options without recommended or duplicates', () => {
    expect(
      buildDiscoverCategoryOptions([
        feed({ id: 'a', url: 'https://a.test/rss.xml', category: 'Tech' }),
        feed({ id: 'b', url: 'https://b.test/rss.xml', folder: 'Tech' }),
        feed({
          id: 'c',
          url: 'https://c.test/rss.xml',
          category: 'Recommended',
        }),
      ]),
    ).toEqual(['Tech'])
  })
})
