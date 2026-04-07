import test from 'node:test'
import assert from 'node:assert/strict'

import { parseBilibiliDynamicEntries } from '../entry/src/main/ets/common/utils/BilibiliDynamicFeed.ts'

test('parseBilibiliDynamicEntries converts desktop dynamic API payload into entries', () => {
  const entries = parseBilibiliDynamicEntries(
    'feed-bilibili-demo',
    {
      items: [
        {
          id_str: '1184691558132219928',
          type: 'DYNAMIC_TYPE_AV',
          modules: [
            {
              module_type: 'MODULE_TYPE_AUTHOR',
              module_author: {
                pub_text: '03月28日 · 投稿了视频',
                pub_ts: 1774670898,
                user: {
                  name: '老番茄',
                },
              },
            },
            {
              module_type: 'MODULE_TYPE_DYNAMIC',
              module_dynamic: {
                type: 'MDL_DYN_TYPE_ARCHIVE',
                dyn_archive: {
                  bvid: 'BV1tFXVBLE5a',
                  title: '抛硬币！连续十次正面就通关！！',
                  desc: '游戏：Unfair Flip',
                  cover: 'http://i1.hdslb.com/bfs/archive/de3afeb.jpg',
                },
              },
            },
          ],
        },
      ],
    } as Record<string, unknown>,
    1774672000000,
  )

  assert.equal(entries.length, 1)
  assert.deepEqual(entries[0], {
    id: 'feed-bilibili-demo-bilibili-dynamic-1184691558132219928',
    feedId: 'feed-bilibili-demo',
    title: '抛硬币！连续十次正面就通关！！',
    url: 'https://www.bilibili.com/video/BV1tFXVBLE5a',
    summary: '游戏：Unfair Flip',
    content:
      '<p>游戏：Unfair Flip</p><p><img src="https://i1.hdslb.com/bfs/archive/de3afeb.jpg" /></p>',
    author: '老番茄',
    publishedAt: 1774670898000,
    readingTimeMinutes: 1,
    tags: ['Bilibili', '动态'],
    mediaUrls: ['https://i1.hdslb.com/bfs/archive/de3afeb.jpg'],
    isRead: false,
    isStarred: false,
    createdAt: 1774672000000,
    updatedAt: 1774672000000,
  })
})
