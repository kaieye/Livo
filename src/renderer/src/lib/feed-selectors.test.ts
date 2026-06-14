import { describe, expect, it } from 'vitest'
import { FeedViewType, type FeedWithCount } from '../../../shared/types'
import {
  buildFeedByIdMap,
  findFeedById,
  findFeedByUrl,
  getFeedsByView,
} from './feed-selectors'

function makeFeed(partial: Partial<FeedWithCount> = {}): FeedWithCount {
  return {
    id: partial.id ?? 'feed-1',
    title: partial.title ?? 'Feed title',
    url: partial.url ?? 'https://example.com/feed.xml',
    view: partial.view ?? FeedViewType.Articles,
    errorCount: partial.errorCount ?? 0,
    createdAt: partial.createdAt ?? 1000,
    unreadCount: partial.unreadCount ?? 0,
    ...partial,
  }
}

describe('feed selectors', () => {
  it('builds a feed lookup by id', () => {
    const feeds = [makeFeed({ id: 'a' }), makeFeed({ id: 'b' })]

    expect(buildFeedByIdMap(feeds).get('b')).toBe(feeds[1])
  })

  it('finds feeds by id', () => {
    const feeds = [makeFeed({ id: 'a' }), makeFeed({ id: 'b' })]

    expect(findFeedById(feeds, 'a')).toBe(feeds[0])
    expect(findFeedById(feeds, 'missing')).toBeNull()
    expect(findFeedById(feeds, null)).toBeNull()
  })

  it('finds feeds by normalized url', () => {
    const feeds = [makeFeed({ id: 'a', url: 'https://Example.com/rss/' })]

    expect(findFeedByUrl(feeds, 'https://example.com/rss')).toBe(feeds[0])
    expect(findFeedByUrl(feeds, 'https://example.com/other')).toBeNull()
    expect(findFeedByUrl(feeds, undefined)).toBeNull()
  })

  it('filters feeds by view and optional category exclusion', () => {
    const feeds = [
      makeFeed({ id: 'article', view: FeedViewType.Articles }),
      makeFeed({ id: 'video', view: FeedViewType.Videos }),
      makeFeed({
        id: 'recommended-video',
        view: FeedViewType.Videos,
        category: 'Recommended',
      }),
    ]

    expect(getFeedsByView(feeds, null)).toEqual(feeds)
    expect(getFeedsByView(feeds, FeedViewType.Videos)).toEqual([
      feeds[1],
      feeds[2],
    ])
    expect(
      getFeedsByView(feeds, FeedViewType.Videos, {
        excludeCategory: 'Recommended',
      }),
    ).toEqual([feeds[1]])
  })
})
