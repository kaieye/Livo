import { describe, expect, it } from 'vitest'
import { mapBilibiliDynamicResponseToFeed } from './bilibili-dynamic'

describe('mapBilibiliDynamicResponseToFeed', () => {
  it('maps official bilibili dynamic payload into feed items', () => {
    const feed = mapBilibiliDynamicResponseToFeed('123', {
      code: 0,
      data: {
        items: [
          {
            id_str: '987654321',
            modules: {
              module_author: {
                name: '测试UP',
                face: 'https://i0.hdslb.com/bfs/face/test.jpg',
                pub_ts: 1710000000,
              },
              module_dynamic: {
                desc: {
                  text: '这是动态正文',
                },
                major: {
                  archive: {
                    title: '测试视频',
                    desc: '视频简介',
                    cover: 'https://i0.hdslb.com/bfs/archive/test.jpg',
                    bvid: 'BV1xx411c7mD',
                  },
                },
              },
            },
          },
        ],
      },
    })

    expect(feed?.title).toBe('测试UP 的 bilibili 动态')
    expect(feed?.items?.[0]?.link).toBe('https://t.bilibili.com/987654321')
    expect(feed?.items?.[0]?.contentSnippet).toContain('这是动态正文')
    expect(feed?.items?.[0]?.contentSnippet).toContain(
      'https://www.bilibili.com/video/BV1xx411c7mD',
    )
    expect(feed?.items?.[0]?.content).toContain('archive/test.jpg')
  })
})
