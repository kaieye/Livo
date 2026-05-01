import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeFeedDetailVideoUrl,
  resolveFeedDetailEntryVideoUrl,
  resolveFeedDetailVideoSourceLabel,
  resolveStaticFeedDetailVideoPreviewUrl,
} from '../entry/src/main/ets/common/utils/FeedDetailVideoPreview.ts'

function entry(overrides = {}) {
  return {
    id: 'entry-1',
    feedId: 'feed-1',
    title: 'Video entry',
    url: '',
    summary: '',
    content: '',
    author: '',
    publishedAt: 0,
    readingTimeMinutes: 0,
    tags: [],
    mediaUrls: [],
    isRead: false,
    isStarred: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

test('feed detail video preview normalizes YouTube and Bilibili urls', () => {
  assert.equal(
    normalizeFeedDetailVideoUrl('https://youtu.be/dQw4w9WgXcQ'),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  )
  assert.equal(
    normalizeFeedDetailVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD'),
    'https://www.bilibili.com/video/BV1xx411c7mD',
  )
})

test('feed detail video preview resolves entry video from media, url and body text', () => {
  assert.equal(
    resolveFeedDetailEntryVideoUrl(
      entry({ mediaUrls: ['https://cdn.example.com/clip.mp4'] }),
    ),
    'https://cdn.example.com/clip.mp4',
  )
  assert.equal(
    resolveFeedDetailEntryVideoUrl(
      entry({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
    ),
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  )
  assert.equal(
    resolveFeedDetailEntryVideoUrl(
      entry({ content: 'watch www.bilibili.com/video/BV1xx411c7mD now' }),
    ),
    'https://www.bilibili.com/video/BV1xx411c7mD',
  )
})

test('feed detail video preview exposes source labels and static covers', () => {
  const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  assert.equal(resolveFeedDetailVideoSourceLabel(videoUrl), 'YouTube')
  assert.equal(
    resolveStaticFeedDetailVideoPreviewUrl(videoUrl),
    'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  )
  assert.equal(
    resolveFeedDetailVideoSourceLabel('https://cdn.example.com/clip.mp4'),
    '直链',
  )
})
