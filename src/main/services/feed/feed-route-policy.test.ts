import { describe, expect, it } from 'vitest'
import { FeedViewType } from '../../../shared/types/index'
import {
  classifyFeedRoute,
  getBootstrapRefreshTimeoutMs,
  getInitialFetchTimeoutMs,
  getRefreshTimeoutMs,
  isSlowFeedUrl,
  shouldDeferBootstrap,
} from './feed-route-policy'

describe('feed-route-policy', () => {
  it('classifies route families behind one policy table', () => {
    expect(classifyFeedRoute('https://rsshub.app/instagram/user/livo')).toBe(
      'instagram-user',
    )
    expect(
      classifyFeedRoute('https://rsshub.app/bilibili/user/dynamic/1'),
    ).toBe('bilibili-dynamic')
    expect(classifyFeedRoute('https://rsshub.app/bilibili/user/video/1')).toBe(
      'bilibili-video',
    )
    expect(classifyFeedRoute('https://rsshub.app/twitter/user/openai')).toBe(
      'twitter-user',
    )
    expect(classifyFeedRoute('https://example.com/feed.xml')).toBe('generic')
  })

  it('keeps refresh timeout budgets for slow route families', () => {
    expect(getRefreshTimeoutMs('https://rsshub.app/instagram/user/livo')).toBe(
      40000,
    )
    expect(
      getRefreshTimeoutMs('https://rsshub.app/bilibili/user/dynamic/1'),
    ).toBe(40000)
    expect(
      getRefreshTimeoutMs('https://rsshub.app/bilibili/user/video/1'),
    ).toBe(120000)
    expect(getRefreshTimeoutMs('https://rsshub.app/twitter/user/openai')).toBe(
      12000,
    )
    expect(isSlowFeedUrl('https://rsshub.app/bilibili/user/video/1')).toBe(true)
  })

  it('keeps subscribe and bootstrap policies for social and video routes', () => {
    expect(
      getInitialFetchTimeoutMs('https://rsshub.app/twitter/user/openai'),
    ).toBe(18000)
    expect(
      getBootstrapRefreshTimeoutMs('https://rsshub.app/twitter/user/openai'),
    ).toBe(45000)
    expect(
      getInitialFetchTimeoutMs('https://rsshub.app/bilibili/user/video/1'),
    ).toBe(45000)
    expect(
      getBootstrapRefreshTimeoutMs('https://rsshub.app/bilibili/user/video/1'),
    ).toBe(120000)
    expect(getInitialFetchTimeoutMs('https://example.com/feed.xml')).toBe(6000)
    expect(getBootstrapRefreshTimeoutMs('https://example.com/feed.xml')).toBe(
      18000,
    )
  })

  it('defers social routes and social-like views to background bootstrap', () => {
    expect(shouldDeferBootstrap('https://rsshub.app/instagram/user/livo')).toBe(
      true,
    )
    expect(shouldDeferBootstrap('https://rsshub.app/twitter/user/openai')).toBe(
      true,
    )
    expect(
      shouldDeferBootstrap(
        'https://example.com/feed.xml',
        FeedViewType.Pictures,
      ),
    ).toBe(true)
    expect(
      shouldDeferBootstrap(
        'https://rsshub.app/bilibili/user/video/1',
        FeedViewType.Videos,
      ),
    ).toBe(false)
  })
})
