import { describe, expect, it } from 'vitest'
import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import {
  buildCachedWideViewEntryModel,
  buildWideViewBaseEntries,
  buildWideViewEntryModel,
} from './wide-view-entry-model'

const RECOMMENDED_CATEGORY = 'Recommended'

function feed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 'feed-1',
    title: 'Feed',
    url: 'https://example.com/feed.xml',
    view: FeedViewType.Articles,
    errorCount: 0,
    createdAt: 1000,
    ...overrides,
  }
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/post',
    publishedAt: 1000,
    isRead: false,
    isStarred: false,
    createdAt: 1000,
    ...overrides,
  }
}

function feedMap(feeds: Feed[]): Map<string, Feed> {
  return new Map(feeds.map((item) => [item.id, item]))
}

describe('buildWideViewBaseEntries', () => {
  it('按当前宽视图过滤条目，并排除推荐源、隐藏源和未知来源', () => {
    const feeds = [
      feed({ id: 'article-feed', view: FeedViewType.Articles }),
      feed({ id: 'video-feed', view: FeedViewType.Videos }),
      feed({
        id: 'recommended-video',
        view: FeedViewType.Videos,
        category: RECOMMENDED_CATEGORY,
      }),
      feed({
        id: 'hidden-video',
        view: FeedViewType.Videos,
        showInAll: false,
      }),
    ]
    const entries = [
      entry({ id: 'article-entry', feedId: 'article-feed' }),
      entry({ id: 'video-entry', feedId: 'video-feed' }),
      entry({ id: 'recommended-entry', feedId: 'recommended-video' }),
      entry({ id: 'hidden-entry', feedId: 'hidden-video' }),
      entry({ id: 'orphan-entry', feedId: 'missing-feed' }),
    ]

    const result = buildWideViewBaseEntries({
      entries,
      feeds,
      feedById: feedMap(feeds),
      activeView: FeedViewType.Videos,
      selectedFeedId: null,
      showRecommended: false,
      recommendedCategory: RECOMMENDED_CATEGORY,
    })

    expect(result.map((item) => item.id)).toEqual(['video-entry'])
  })

  it('选中具体订阅源时只按 feedId 过滤，不套用全部视图排除规则', () => {
    const hiddenFeed = feed({
      id: 'hidden-feed',
      view: FeedViewType.Videos,
      showInAll: false,
      category: RECOMMENDED_CATEGORY,
    })
    const entries = [
      entry({ id: 'selected-entry', feedId: hiddenFeed.id }),
      entry({ id: 'other-entry', feedId: 'other-feed' }),
    ]

    const result = buildWideViewBaseEntries({
      entries,
      feeds: [hiddenFeed],
      feedById: feedMap([hiddenFeed]),
      activeView: FeedViewType.Videos,
      selectedFeedId: hiddenFeed.id,
      showRecommended: false,
      recommendedCategory: RECOMMENDED_CATEGORY,
    })

    expect(result.map((item) => item.id)).toEqual(['selected-entry'])
  })

  it('收藏范围复用已加载条目，不再按 feed 过滤', () => {
    const entries = [
      entry({ id: 'starred-a', feedId: 'feed-a' }),
      entry({ id: 'starred-b', feedId: 'missing-feed' }),
    ]

    const result = buildWideViewBaseEntries({
      entries,
      feeds: [],
      feedById: new Map(),
      activeView: null,
      selectedFeedId: 'starred',
      showRecommended: false,
      recommendedCategory: RECOMMENDED_CATEGORY,
    })

    expect(result).toBe(entries)
  })
})

describe('buildWideViewEntryModel', () => {
  it('加载或社交去重处理中保留旧条目，避免列表闪空', () => {
    const staleEntries = [entry({ id: 'stale-entry' })]

    const model = buildWideViewEntryModel({
      entries: staleEntries,
      viewFilteredEntries: [],
      feedById: feedMap([feed()]),
      isLoading: true,
      isSocialDedupeProcessing: false,
    })

    expect(model.renderEntries).toBe(staleEntries)
    expect(model.shouldShowLoadingSkeleton).toBe(false)
  })

  it('生成时间线、视频和索引所需的派生映射', () => {
    const sourceFeed = feed({
      title: 'Video Feed',
      imageUrl: 'https://example.com/avatar.png',
      siteUrl: 'https://example.com',
    })
    const entries = [
      entry({ id: 'first', feedId: sourceFeed.id }),
      entry({ id: 'second', feedId: sourceFeed.id }),
    ]

    const model = buildWideViewEntryModel({
      entries,
      viewFilteredEntries: entries,
      feedById: feedMap([sourceFeed]),
      isLoading: false,
      isSocialDedupeProcessing: false,
    })

    expect(model.timelineIndexById.get('second')).toBe(1)
    expect(model.renderEntryIndexById.get('first')).toBe(0)
    expect(model.renderEntryById.get('second')).toBe(entries[1])
    expect(model.timelineFeedMetaByEntryId.get('first')).toEqual({
      title: 'Video Feed',
      imageUrl: 'https://example.com/avatar.png',
      siteUrl: 'https://example.com',
      url: 'https://example.com/feed.xml',
    })
    expect(model.videoFeedMetaByEntryId.get('first')).toEqual({
      title: 'Video Feed',
      imageUrl: 'https://example.com/avatar.png',
    })
  })

  it('同一宽视图范围和同一数据引用复用派生模型缓存', () => {
    const feeds = [feed({ id: 'feed-a' })]
    const entries = [entry({ id: 'entry-a', feedId: 'feed-a' })]
    const feedById = feedMap(feeds)
    const input = {
      entries,
      viewFilteredEntries: entries,
      feedById,
      isLoading: false,
      isSocialDedupeProcessing: false,
      cacheKey: 'wide-view-cache-test',
    }

    const first = buildCachedWideViewEntryModel(input)
    const second = buildCachedWideViewEntryModel(input)

    expect(second).toBe(first)
  })

  it('feed 映射引用变化时不会复用宽视图缓存', () => {
    const sourceFeed = feed({ id: 'feed-a' })
    const entries = [entry({ id: 'entry-a', feedId: sourceFeed.id })]
    const base = {
      entries,
      viewFilteredEntries: entries,
      isLoading: false,
      isSocialDedupeProcessing: false,
      cacheKey: 'wide-view-cache-invalidates',
    }

    const first = buildCachedWideViewEntryModel({
      ...base,
      feedById: feedMap([sourceFeed]),
    })
    const second = buildCachedWideViewEntryModel({
      ...base,
      feedById: feedMap([sourceFeed]),
    })

    expect(second).not.toBe(first)
  })
})
