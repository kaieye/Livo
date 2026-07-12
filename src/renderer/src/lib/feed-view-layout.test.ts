import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types'
import {
  isWideLayoutView,
  resolveEffectiveView,
  shouldUseSocialDetailOverlay,
} from './feed-view-layout'

describe('isWideLayoutView', () => {
  it('将 Articles 视为窄布局', () => {
    expect(isWideLayoutView(FeedViewType.Articles)).toBe(false)
  })

  it('将 Social/Videos/Pictures 视为宽布局', () => {
    expect(isWideLayoutView(FeedViewType.SocialMedia)).toBe(true)
    expect(isWideLayoutView(FeedViewType.Videos)).toBe(true)
    expect(isWideLayoutView(FeedViewType.Pictures)).toBe(true)
  })

  it('将 null 视为窄布局', () => {
    expect(isWideLayoutView(null)).toBe(false)
  })
})

describe('resolveEffectiveView', () => {
  it('当 activeView 为 null 且选中宽布局订阅源时，采用订阅源的视图', () => {
    expect(
      resolveEffectiveView({
        activeView: null,
        selectedFeed: { view: FeedViewType.SocialMedia },
      }),
    ).toBe(FeedViewType.SocialMedia)
    expect(
      resolveEffectiveView({
        activeView: null,
        selectedFeed: { view: FeedViewType.Videos },
      }),
    ).toBe(FeedViewType.Videos)
    expect(
      resolveEffectiveView({
        activeView: null,
        selectedFeed: { view: FeedViewType.Pictures },
      }),
    ).toBe(FeedViewType.Pictures)
  })

  it('当 activeView 为 null 且选中 Articles 订阅源时，不提升有效视图', () => {
    expect(
      resolveEffectiveView({
        activeView: null,
        selectedFeed: { view: FeedViewType.Articles },
      }),
    ).toBeNull()
  })

  it('当 activeView 为 null 且无选中订阅源时，返回 null', () => {
    expect(
      resolveEffectiveView({ activeView: null, selectedFeed: null }),
    ).toBeNull()
    expect(resolveEffectiveView({ activeView: null })).toBeNull()
  })

  it('当 activeView 已设置时，始终以 activeView 为准', () => {
    expect(
      resolveEffectiveView({
        activeView: FeedViewType.Articles,
        selectedFeed: { view: FeedViewType.SocialMedia },
      }),
    ).toBe(FeedViewType.Articles)
    expect(
      resolveEffectiveView({
        activeView: FeedViewType.SocialMedia,
        selectedFeed: { view: FeedViewType.Articles },
      }),
    ).toBe(FeedViewType.SocialMedia)
  })

  it('容忍订阅源 view 为 undefined 或 null', () => {
    expect(
      resolveEffectiveView({ activeView: null, selectedFeed: {} }),
    ).toBeNull()
    expect(
      resolveEffectiveView({ activeView: null, selectedFeed: { view: null } }),
    ).toBeNull()
  })
})

describe('shouldUseSocialDetailOverlay', () => {
  it('在全部聚合列表中为社交条目启用推文详情覆盖层', () => {
    expect(
      shouldUseSocialDetailOverlay({
        activeView: null,
        selectedFeedId: null,
        selectedEntryFeedView: FeedViewType.SocialMedia,
      }),
    ).toBe(true)
  })

  it('不接管推文栏目或已选中特定订阅源的现有布局', () => {
    expect(
      shouldUseSocialDetailOverlay({
        activeView: FeedViewType.SocialMedia,
        selectedFeedId: null,
        selectedEntryFeedView: FeedViewType.SocialMedia,
      }),
    ).toBe(false)
    expect(
      shouldUseSocialDetailOverlay({
        activeView: null,
        selectedFeedId: 'feed-x',
        selectedEntryFeedView: FeedViewType.SocialMedia,
      }),
    ).toBe(false)
  })

  it('在全部聚合列表中保留普通文章详情', () => {
    expect(
      shouldUseSocialDetailOverlay({
        activeView: null,
        selectedFeedId: null,
        selectedEntryFeedView: FeedViewType.Articles,
      }),
    ).toBe(false)
  })
})
