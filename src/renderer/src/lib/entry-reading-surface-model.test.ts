import { describe, expect, it } from 'vitest'
import { FeedViewType, type Entry, type Feed } from '../../../shared/types'
import {
  buildEntryReadingSurfaceRenderModel,
  buildEntryReadingSurfaceScopeModel,
} from './entry-reading-surface-model'

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

describe('buildEntryReadingSurfaceScopeModel', () => {
  it('按当前视图过滤条目，并排除推荐源、隐藏源和未知来源', () => {
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
    const model = buildEntryReadingSurfaceScopeModel({
      entries: [
        entry({ id: 'article-entry', feedId: 'article-feed' }),
        entry({ id: 'video-entry', feedId: 'video-feed' }),
        entry({ id: 'recommended-entry', feedId: 'recommended-video' }),
        entry({ id: 'hidden-entry', feedId: 'hidden-video' }),
        entry({ id: 'orphan-entry', feedId: 'missing-feed' }),
      ],
      feeds,
      activeView: FeedViewType.Videos,
      selectedFeedId: null,
      showRecommended: false,
      recommendedCategory: RECOMMENDED_CATEGORY,
    })

    expect(model.scopedEntries.map((item) => item.id)).toEqual(['video-entry'])
    expect(model.recommendedFeedIds.has('recommended-video')).toBe(true)
  })

  it('选中具体订阅源时只按 feedId 过滤，不套用全部视图排除规则', () => {
    const hiddenFeed = feed({
      id: 'hidden-feed',
      view: FeedViewType.Videos,
      showInAll: false,
      category: RECOMMENDED_CATEGORY,
    })

    const model = buildEntryReadingSurfaceScopeModel({
      entries: [
        entry({ id: 'selected-entry', feedId: hiddenFeed.id }),
        entry({ id: 'other-entry', feedId: 'other-feed' }),
      ],
      feeds: [hiddenFeed],
      activeView: FeedViewType.Videos,
      selectedFeedId: hiddenFeed.id,
      showRecommended: false,
      recommendedCategory: RECOMMENDED_CATEGORY,
    })

    expect(model.currentFeed).toBe(hiddenFeed)
    expect(model.scopedEntries.map((item) => item.id)).toEqual([
      'selected-entry',
    ])
  })

  it('收藏范围复用已加载条目，不再按 feed 过滤', () => {
    const entries = [
      entry({ id: 'starred-a', feedId: 'feed-a' }),
      entry({ id: 'starred-b', feedId: 'missing-feed' }),
    ]

    const model = buildEntryReadingSurfaceScopeModel({
      entries,
      feeds: [],
      activeView: null,
      selectedFeedId: 'starred',
      showRecommended: false,
      recommendedCategory: RECOMMENDED_CATEGORY,
    })

    expect(model.scopedEntries).toBe(entries)
  })
})

describe('buildEntryReadingSurfaceRenderModel', () => {
  it('宽范围加载中可以保留旧条目，避免列表闪空', () => {
    const staleEntries = [entry({ id: 'stale-entry' })]

    const model = buildEntryReadingSurfaceRenderModel({
      sourceEntries: staleEntries,
      scopedEntries: [],
      isLoading: true,
      isPostProcessing: false,
      allowStaleEntriesWhileLoading: true,
    })

    expect(model.renderEntries).toBe(staleEntries)
    expect(model.hasStaleEntriesWhileLoading).toBe(true)
    expect(model.shouldShowLoadingSkeleton).toBe(false)
  })

  it('具体订阅源加载中不复用上一个范围的旧条目', () => {
    const model = buildEntryReadingSurfaceRenderModel({
      sourceEntries: [entry({ id: 'stale-entry' })],
      scopedEntries: [],
      isLoading: true,
      isPostProcessing: false,
      allowStaleEntriesWhileLoading: false,
    })

    expect(model.renderEntries).toEqual([])
    expect(model.hasStaleEntriesWhileLoading).toBe(false)
    expect(model.shouldShowLoadingSkeleton).toBe(true)
  })
})
