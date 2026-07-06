import { describe, expect, it } from 'vitest'
import type { Entry } from '../../../../shared/types'
import { inferEntryImageUrl, inferEntryMediaUrl } from './ContextMenu'

function createEntry(partial: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Entry',
    url: 'https://example.com/post',
    publishedAt: 1,
    isRead: false,
    isStarred: false,
    createdAt: 1,
    ...partial,
  }
}

describe('ContextMenu media inference', () => {
  it('uses a safe photo preview before the original photo URL', () => {
    const entry = createEntry({
      media: [
        {
          type: 'photo',
          previewUrl: ' https://cdn.example.com/preview.jpg ',
          url: 'https://cdn.example.com/original.jpg',
        },
      ],
    })

    expect(inferEntryImageUrl(entry)).toBe(
      'https://cdn.example.com/preview.jpg',
    )
  })

  it('skips unsafe photo previews and falls back to a safe photo URL', () => {
    const entry = createEntry({
      media: [
        {
          type: 'photo',
          previewUrl: 'http://127.0.0.1/preview.jpg',
          url: 'https://cdn.example.com/original.jpg',
        },
      ],
    })

    expect(inferEntryImageUrl(entry)).toBe(
      'https://cdn.example.com/original.jpg',
    )
  })

  it('blocks unsafe entry image fallback URLs', () => {
    const entry = createEntry({
      imageUrl: 'http://169.254.169.254/latest/meta-data',
    })

    expect(inferEntryImageUrl(entry)).toBe('')
  })

  it('uses a safe video media URL before its preview URL', () => {
    const entry = createEntry({
      media: [
        {
          type: 'video',
          url: 'https://cdn.example.com/video.mp4',
          previewUrl: 'https://cdn.example.com/video.jpg',
        },
      ],
    })

    expect(inferEntryMediaUrl(entry)).toBe('https://cdn.example.com/video.mp4')
  })

  it('skips unsafe video URLs and falls back to a safe preview URL', () => {
    const entry = createEntry({
      media: [
        {
          type: 'video',
          url: 'https://user:pass@example.com/video.mp4',
          previewUrl: 'https://cdn.example.com/video.jpg',
        },
      ],
    })

    expect(inferEntryMediaUrl(entry)).toBe('https://cdn.example.com/video.jpg')
  })
})
