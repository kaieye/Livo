import { describe, expect, it } from 'vitest'
import { FeedViewType, type Entry } from '../../../shared/types'
import { buildEntryListDerivedModel } from './entry-list-model'

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/post',
    publishedAt: Date.now(),
    isRead: false,
    isStarred: false,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('buildEntryListDerivedModel', () => {
  it('为社交视图构建带日期标题的虚拟行，并保留原始条目索引', () => {
    const model = buildEntryListDerivedModel({
      baseRenderEntries: [
        entry({ id: 'a', publishedAt: Date.now() }),
        entry({ id: 'b', publishedAt: Date.now() }),
      ],
      activeView: FeedViewType.SocialMedia,
      groupByDate: true,
      isGridMode: false,
      gridVisibleCount: 40,
    })

    expect(model.useVirtualSocialList).toBe(true)
    expect(model.useVirtualLinearList).toBe(false)
    expect(model.socialRows.map((row) => row.type)).toEqual([
      'header',
      'entry',
      'entry',
    ])
    expect(model.socialRows[1]).toMatchObject({
      key: 'a',
      type: 'entry',
      entryIndex: 0,
    })
    expect(model.socialRows[2]).toMatchObject({
      key: 'b',
      type: 'entry',
      entryIndex: 1,
    })
  })

  it('为网格视图按两列切分可见条目并暴露加载更多状态', () => {
    const model = buildEntryListDerivedModel({
      baseRenderEntries: [
        entry({ id: 'a' }),
        entry({ id: 'b' }),
        entry({ id: 'c' }),
      ],
      activeView: FeedViewType.Pictures,
      groupByDate: false,
      isGridMode: true,
      gridVisibleCount: 2,
    })

    expect(model.gridRows.map((row) => row.map((item) => item.id))).toEqual([
      ['a', 'b'],
    ])
    expect(model.hasMoreGridEntries).toBe(true)
    expect(model.virtualizerEntries).toEqual([])
  })

  it('在社交视图折叠同一帖子的视频前封面条目', () => {
    const model = buildEntryListDerivedModel({
      baseRenderEntries: [
        entry({
          id: 'cover',
          title: 'same post',
          imageUrl: 'https://cdninstagram.com/photo.jpg?ig_cache_key=c2FtZS4x',
        }),
        entry({
          id: 'video',
          title: 'same post',
          media: [
            {
              type: 'video',
              url: 'https://example.com/video.mp4',
              previewUrl:
                'https://cdninstagram.com/photo.jpg?ig_cache_key=c2FtZS4x',
            },
          ],
        }),
      ],
      activeView: FeedViewType.SocialMedia,
      groupByDate: false,
      isGridMode: false,
      gridVisibleCount: 40,
    })

    expect(model.renderEntries.map((item) => item.id)).toEqual(['video'])
  })
})
