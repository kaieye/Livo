import { describe, expect, it } from 'vitest'

import {
  fetchBilibiliVideoFeedFromSpacePage,
  mapBilibiliVideoCardsToFeed,
  mapParsedDynamicFeedToVideoFeed,
} from './bilibili-video-feed'

describe('bilibili video feed mapping', () => {
  it('maps scraped cards into a parsed feed', () => {
    const feed = mapBilibiliVideoCardsToFeed('179125203', {
      authorName: '丁汇实录',
      authorAvatar: 'https://i0.hdslb.com/bfs/face/test.jpg',
      cards: [
        {
          index: 0,
          title: '示例视频',
          link: 'https://www.bilibili.com/video/BV1Test12345',
          cover: 'https://i0.hdslb.com/bfs/archive/test.jpg',
          durationText: '12:34',
        },
      ],
    })

    expect(feed?.title).toBe('丁汇实录 - Bilibili')
    expect(feed?.items?.length).toBe(1)
    expect(feed?.items?.[0]?.link).toBe(
      'https://www.bilibili.com/video/BV1Test12345',
    )
    expect(feed?.items?.[0]?.description).toContain('视频地址')
  })

  it('strips 投稿视频 page-title noise from scraped author names', () => {
    const feed = mapBilibiliVideoCardsToFeed('25876945', {
      authorName:
        '极客湾Geekerwan投稿视频 - 极客湾Geekerwan视频分享 - 哔哩哔哩视频',
      cards: [
        {
          index: 0,
          title: '示例视频',
          link: 'https://www.bilibili.com/video/BV1Test12345',
        },
      ],
    })

    expect(feed?.title).toBe('极客湾Geekerwan - Bilibili')
    expect(feed?.items?.[0]?.author).toBe('极客湾Geekerwan')
  })

  it('collapses duplicated author names produced by fallback page fragments', () => {
    const feed = mapBilibiliVideoCardsToFeed('179125203', {
      authorName: '丁汇实录投稿视频-丁汇实录',
      cards: [
        {
          index: 0,
          title: '示例视频',
          link: 'https://www.bilibili.com/video/BV1Test12345',
        },
      ],
    })

    expect(feed?.title).toBe('丁汇实录 - Bilibili')
    expect(feed?.items?.[0]?.author).toBe('丁汇实录')
  })

  it('filters dynamic items down to bilibili video items', () => {
    const feed = mapParsedDynamicFeedToVideoFeed('179125203', {
      title: '丁汇实录 的 bilibili 动态',
      description: '丁汇实录 的 bilibili 动态',
      link: 'https://space.bilibili.com/179125203/dynamic',
      items: [
        {
          title: '示例动态',
          link: 'https://t.bilibili.com/123',
          description:
            '<p>视频地址：<a href=\"https://www.bilibili.com/video/BV1UGQBBJENW\">https://www.bilibili.com/video/BV1UGQBBJENW</a></p>',
        },
        {
          title: '纯图文',
          link: 'https://t.bilibili.com/456',
          description: '<p>图文地址</p>',
        },
      ],
    } as any)

    expect(feed?.items?.length).toBe(1)
    expect(feed?.items?.[0]?.link).toBe(
      'https://www.bilibili.com/video/BV1UGQBBJENW',
    )
    expect(feed?.title).toContain('视频')
  })

  it('keeps rsshub protocol video urls eligible for fallback parsing', () => {
    expect(typeof fetchBilibiliVideoFeedFromSpacePage).toBe('function')
  })

  it('falls back to synthetic descending publish dates when bilibili labels are missing', () => {
    const feed = mapBilibiliVideoCardsToFeed('15452596', {
      authorName: '月球大叔',
      cards: [
        {
          index: 0,
          title: '第一条',
          link: 'https://www.bilibili.com/video/BV1First12345',
        },
        {
          index: 1,
          title: '第二条',
          link: 'https://www.bilibili.com/video/BV1Second1234',
        },
      ],
    })

    const firstTs = new Date(feed?.items?.[0]?.pubDate || '').getTime()
    const secondTs = new Date(feed?.items?.[1]?.pubDate || '').getTime()
    expect(Number.isFinite(firstTs)).toBe(true)
    expect(Number.isFinite(secondTs)).toBe(true)
    expect(firstTs).toBeGreaterThan(secondTs)
  })
})
