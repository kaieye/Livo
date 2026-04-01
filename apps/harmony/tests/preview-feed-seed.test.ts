import test from 'node:test'
import assert from 'node:assert/strict'

import { rekeyPreviewEntries } from '../entry/src/main/ets/common/utils/PreviewFeedSeed.ts'

test('rekeyPreviewEntries remaps preview entries onto the subscribed feed while preserving media urls', () => {
  const next = rekeyPreviewEntries('feed-instagram-du', [
    {
      id: 'preview-1',
      feedId: 'preview-123',
      title: 'Post 1',
      url: 'https://www.instagram.com/p/demo-1/',
      summary: 'summary',
      content: '<p>content</p>',
      author: 'du_chenduling',
      publishedAt: 1710000000000,
      readingTimeMinutes: 1,
      tags: [],
      mediaUrls: [
        'https://scontent.cdninstagram.com/v/t51.2885-15/1?stp=dst-jpg_e35',
      ],
      isRead: false,
      isStarred: false,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
    },
  ])

  assert.equal(next.length, 1)
  assert.equal(next[0]?.feedId, 'feed-instagram-du')
  assert.equal(next[0]?.id, 'feed-instagram-du-preview-1')
  assert.deepEqual(next[0]?.mediaUrls, [
    'https://scontent.cdninstagram.com/v/t51.2885-15/1?stp=dst-jpg_e35',
  ])
})

test('rekeyPreviewEntries keeps mirrored instagram preview entries distinct when they share the same profile url', () => {
  const next = rekeyPreviewEntries('feed-instagram-du', [
    {
      id: 'preview-instagram-0',
      feedId: 'preview-123',
      title: '🍓🧤',
      url: 'https://www.instagram.com/du_chenduling/',
      summary: 'summary',
      content: '<p>content</p>',
      author: 'du_chenduling',
      publishedAt: 1710000000000,
      readingTimeMinutes: 1,
      tags: [],
      mediaUrls: [
        'https://media.picnob.info/get?url=https://cdninstagram.com/v/t51.2885-15/asset-1.jpg',
      ],
      isRead: false,
      isStarred: false,
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
    },
    {
      id: 'preview-instagram-1',
      feedId: 'preview-123',
      title: '🍰🎠',
      url: 'https://www.instagram.com/du_chenduling/',
      summary: 'summary 2',
      content: '<p>content 2</p>',
      author: 'du_chenduling',
      publishedAt: 1710000001000,
      readingTimeMinutes: 1,
      tags: [],
      mediaUrls: [
        'https://media.picnob.info/get?url=https://cdninstagram.com/v/t51.2885-15/asset-2.jpg',
      ],
      isRead: false,
      isStarred: false,
      createdAt: 1710000001000,
      updatedAt: 1710000001000,
    },
  ])

  assert.equal(next.length, 2)
  assert.notEqual(next[0]?.id, next[1]?.id)
  assert.equal(next[0]?.id, 'feed-instagram-du-preview-instagram-0')
  assert.equal(next[1]?.id, 'feed-instagram-du-preview-instagram-1')
})
