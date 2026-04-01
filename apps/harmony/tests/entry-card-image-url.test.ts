import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveEntryCardImageUrl } from '../entry/src/main/ets/common/utils/EntryCardPreview.ts'

test('resolveEntryCardImageUrl derives youtube thumbnail image for video entries', () => {
  assert.equal(
    resolveEntryCardImageUrl({
      title: 'video title',
      summary: '',
      content: '',
      articleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      siteUrl: 'https://www.youtube.com/@demo',
      mediaUrls: [],
    }),
    'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  )
})

test('resolveEntryCardImageUrl keeps instagram cdn media urls without file extensions', () => {
  assert.equal(
    resolveEntryCardImageUrl({
      title: 'photo title',
      summary: '',
      content: '',
      articleUrl: 'https://www.instagram.com/p/demo/',
      siteUrl: 'https://www.instagram.com/demo/',
      mediaUrls: [
        'https://scontent.cdninstagram.com/v/t51.2885-15/987654321?stp=dst-jpg_e35',
      ],
    }),
    'https://scontent.cdninstagram.com/v/t51.2885-15/987654321?stp=dst-jpg_e35',
  )
})
