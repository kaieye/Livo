import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types'
import {
  areHomeFeedLoadOptionsEqual,
  buildHomeFeedLoadOptions,
  buildHomeFeedRefreshTarget,
  buildHomeFeedScopeCacheKey,
  buildHomeFeedScopeDescriptor,
  computeViewFeedIds,
  resolveScopedEntriesForRender,
} from './home-feed-scope'

describe('home-feed-scope', () => {
  const feeds = [
    { id: 'article-1', view: FeedViewType.Articles },
    { id: 'social-1', view: FeedViewType.SocialMedia },
    { id: 'social-hidden', view: FeedViewType.SocialMedia, showInAll: false },
    {
      id: 'social-recommended',
      view: FeedViewType.SocialMedia,
      category: 'Recommended',
    },
  ]

  it('按当前范围构建列表加载参数', () => {
    expect(
      buildHomeFeedLoadOptions({
        selectedFeedId: 'starred',
        activeView: FeedViewType.SocialMedia,
        feeds,
        unreadOnly: true,
        limit: 20,
      }),
    ).toEqual({ starred: true, unreadOnly: true, limit: 20 })

    expect(
      buildHomeFeedLoadOptions({
        selectedFeedId: 'feed-1',
        activeView: null,
        feeds,
        limit: 20,
      }),
    ).toEqual({ feedId: 'feed-1', unreadOnly: undefined, limit: 20 })

    expect(
      buildHomeFeedLoadOptions({
        selectedFeedId: null,
        activeView: FeedViewType.SocialMedia,
        feeds,
        limit: 20,
      }),
    ).toEqual({
      feedIds: ['social-1', 'social-recommended'],
      unreadOnly: undefined,
      limit: 20,
    })
  })

  it('栏目里只有一个可见订阅源时使用单 feed 加载路径', () => {
    expect(
      buildHomeFeedLoadOptions({
        selectedFeedId: null,
        activeView: FeedViewType.Videos,
        feeds: [
          { id: 'video-hidden', view: FeedViewType.Videos, showInAll: false },
          { id: 'video-1', view: FeedViewType.Videos },
        ],
        limit: 20,
      }),
    ).toEqual({ feedId: 'video-1', unreadOnly: undefined, limit: 20 })
  })

  it('栏目没有订阅源时返回空 feedIds 数组避免加载所有文章', () => {
    expect(
      buildHomeFeedLoadOptions({
        selectedFeedId: null,
        activeView: FeedViewType.Videos,
        feeds: [
          { id: 'article-1', view: FeedViewType.Articles },
          { id: 'social-1', view: FeedViewType.SocialMedia },
        ],
        limit: 20,
      }),
    ).toEqual({ feedIds: [], unreadOnly: undefined, limit: 20 })
  })

  it('过滤 view 列表时按需排除推荐源', () => {
    expect(
      computeViewFeedIds(feeds, FeedViewType.SocialMedia, 'Recommended'),
    ).toEqual(['social-1'])
  })

  it('按当前范围构建刷新目标', () => {
    expect(
      buildHomeFeedRefreshTarget({
        selectedFeedId: 'feed-1',
        activeView: FeedViewType.SocialMedia,
        feeds,
      }),
    ).toEqual({ type: 'feed', feedId: 'feed-1' })

    expect(
      buildHomeFeedRefreshTarget({
        selectedFeedId: 'starred',
        activeView: FeedViewType.SocialMedia,
        feeds,
      }),
    ).toEqual({
      type: 'feeds',
      feedIds: ['social-1', 'social-hidden', 'social-recommended'],
    })

    expect(
      buildHomeFeedRefreshTarget({
        selectedFeedId: null,
        activeView: null,
        feeds,
      }),
    ).toEqual({ type: 'all' })
  })

  it('比较加载范围时忽略 feedIds 顺序并区分 limit', () => {
    expect(
      areHomeFeedLoadOptionsEqual(
        { feedIds: ['b', 'a'], unreadOnly: true, limit: 20 },
        { feedIds: ['a', 'b'], unreadOnly: true, limit: 20 },
      ),
    ).toBe(true)

    expect(
      areHomeFeedLoadOptionsEqual(
        { feedIds: ['a', 'b'], unreadOnly: true, limit: 20 },
        { feedIds: ['a', 'b'], unreadOnly: true, limit: 40 },
      ),
    ).toBe(false)

    expect(
      areHomeFeedLoadOptionsEqual(
        { feedId: 'feed-1', limit: 20 },
        { feedId: 'feed-2', limit: 20 },
      ),
    ).toBe(false)
  })

  it('范围未匹配时优先使用当前范围缓存快照', () => {
    expect(
      resolveScopedEntriesForRender({
        entries: ['fresh'],
        entriesMatchCurrentScope: true,
        cachedEntries: ['cached'],
      }),
    ).toEqual({ entries: ['fresh'], isUsingCachedScope: false })

    expect(
      resolveScopedEntriesForRender({
        entries: ['old-scope'],
        entriesMatchCurrentScope: false,
        cachedEntries: ['cached'],
      }),
    ).toEqual({ entries: ['cached'], isUsingCachedScope: true })

    expect(
      resolveScopedEntriesForRender({
        entries: ['old-scope'],
        entriesMatchCurrentScope: false,
      }),
    ).toEqual({ entries: [], isUsingCachedScope: false })
  })

  it('构建阅读面范围描述符', () => {
    const descriptor = buildHomeFeedScopeDescriptor({
      selectedFeedId: null,
      activeView: FeedViewType.SocialMedia,
      feeds,
      filterMode: 'unread',
      showRecommended: false,
      recommendedCategory: 'Recommended',
      paginationOptions: {
        feedIds: ['social-recommended', 'social-1'],
        unreadOnly: true,
      },
      paginationPageSize: 20,
      limit: 20,
    })

    expect(descriptor).toEqual({
      loadOptions: {
        feedIds: ['social-1', 'social-recommended'],
        unreadOnly: true,
        limit: 20,
      },
      cacheKey: '1:all:unread:no-recommended',
      entriesMatchCurrentScope: true,
      viewFeedIds: ['social-1'],
    })
  })

  it('构建稳定的阅读面范围缓存 key', () => {
    expect(
      buildHomeFeedScopeCacheKey({
        activeView: null,
        selectedFeedId: 'starred',
        filterMode: 'all',
        showRecommended: true,
      }),
    ).toBe('all:starred:all:with-recommended')
  })
})
