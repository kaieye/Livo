import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../shared/types'
import {
  buildMediaFallbackCandidates,
  dedupeGalleryPhotoVariants,
  findRelatedSocialEntryFallback,
  resolveGridCardMedia,
  resolveSocialEntryMediaDecision,
} from './entry-media-decision'

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

describe('entry-media-decision', () => {
  it('gallery 去重时优先保留带 Instagram 缓存键和 previewUrl 的高质量变体', () => {
    const result = dedupeGalleryPhotoVariants([
      {
        url: 'https://cdninstagram.com/photo.jpg?ig_cache_key=abc',
      },
      {
        url: 'https://cdninstagram.com/photo.jpg?ig_cache_key=abc',
        previewUrl:
          'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Fig_cache_key%3Dabc',
      },
      {
        url: 'https://img.example/other.jpg',
      },
    ])

    expect(result).toEqual([
      {
        url: 'https://cdninstagram.com/photo.jpg?ig_cache_key=abc',
        previewUrl:
          'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Fig_cache_key%3Dabc',
      },
      {
        url: 'https://img.example/other.jpg',
      },
    ])
  })

  it('构建图片 fallback 时保留原始 URL、镜像源和代理候选且去重', () => {
    const candidates = buildMediaFallbackCandidates(
      'https://cdninstagram.com/photo.jpg?oh=1',
      'https://cdninstagram.com/photo.jpg?oh=1',
      'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Foh%3D1',
    )

    expect(candidates[0]).toBe('https://cdninstagram.com/photo.jpg?oh=1')
    expect(candidates).toContain(
      'https://media.pixnoy.com/get?url=https%3A%2F%2Fcdninstagram.com%2Fphoto.jpg%3Foh%3D1',
    )
    expect(new Set(candidates).size).toBe(candidates.length)
  })

  it('为网格卡片优先选择 photo preview，并在没有图片时派生 YouTube 缩略图', () => {
    expect(
      resolveGridCardMedia(
        entry({
          media: [
            {
              type: 'photo',
              url: 'https://example.com/full.jpg',
              previewUrl: 'https://example.com/preview.jpg',
            },
          ],
        }),
      ),
    ).toMatchObject({
      photoCovers: [
        'https://example.com/preview.jpg',
        'https://example.com/full.jpg',
      ],
      coverUrl: 'https://example.com/preview.jpg',
      photoCount: 1,
    })

    expect(
      resolveGridCardMedia(
        entry({
          media: [],
          url: 'https://www.youtube.com/watch?v=abc123',
        }),
      ).coverUrl,
    ).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg')
  })

  it('为社交视频补齐图片预览，并隐藏 Bilibili 页面视频的图片 gallery', () => {
    const decision = resolveSocialEntryMediaDecision({
      entry: entry({
        imageUrl: 'https://example.com/fallback.jpg',
        media: [
          {
            type: 'photo',
            url: 'https://example.com/photo.jpg',
          },
          {
            type: 'video',
            url: 'https://www.bilibili.com/video/BV1xx411c7mD',
          },
        ],
      }),
    })

    expect(decision.visibleVideos[0]?.previewUrl).toBe(
      'https://example.com/photo.jpg',
    )
    expect(decision.hasBilibiliPageVideo).toBe(true)
    expect(decision.galleryPhotos).toEqual([])
  })

  it('能为同一社交帖子找到带封面的关联条目', () => {
    const base = entry({
      id: 'base',
      title: 'same text',
      content: 'https://www.instagram.com/p/ABC123/',
    })
    const related = entry({
      id: 'related',
      title: 'same text',
      content: 'https://www.instagram.com/p/ABC123/',
      imageUrl: 'https://example.com/cover.jpg',
    })

    expect(findRelatedSocialEntryFallback(base, [base, related])).toMatchObject(
      {
        candidate: related,
        cover: 'https://example.com/cover.jpg',
      },
    )
  })
})
