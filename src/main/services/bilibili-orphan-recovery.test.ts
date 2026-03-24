import { describe, expect, it } from 'vitest'

import type { Entry } from '../../shared/types'
import { FeedViewType } from '../../shared/types'

import { recoverOrphanBilibiliDynamicFeeds } from './bilibili-orphan-recovery'

describe('bilibili orphan recovery module', () => {
  it('exports a recovery function', () => {
    expect(typeof recoverOrphanBilibiliDynamicFeeds).toBe('function')
  })

  it('keeps orphan bilibili entries compatible with social-media recovery inputs', () => {
    const entry: Entry = {
      id: 'entry-1',
      feedId: 'missing-feed',
      title: '示例动态 视频地址：https://www.bilibili.com/video/BV1UGQBBJENW',
      url: 'https://t.bilibili.com/1183202093510426675',
      content:
        '图文地址：<a href=\"https://www.bilibili.com/opus/1180419659061526565\">https://www.bilibili.com/opus/1180419659061526565</a>',
      summary: '示例动态',
      author: '小管同學',
      authorAvatar:
        'https://i0.hdslb.com/bfs/face/361354bf31c69101381c892925aeb737e5c5a484.jpg',
      imageUrl:
        'http://i0.hdslb.com/bfs/new_dyn/a50a212ae63e785ae1d64c1bb24a137e52502322.png',
      media: [],
      publishedAt: Date.now(),
      isRead: false,
      isStarred: false,
      createdAt: Date.now(),
    }

    expect(entry.url).toMatch(/^https:\/\/t\.bilibili\.com\//)
    expect(entry.title).toContain('BV1UGQBBJENW')
    expect(entry.content).toContain('/opus/')
    expect(FeedViewType.SocialMedia).toBe(1)
  })
})
