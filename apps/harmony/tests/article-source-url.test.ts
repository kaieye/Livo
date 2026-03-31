import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveArticleSourceUrl } from '../entry/src/main/ets/common/utils/ArticleSourceUrl.ts'

test('resolveArticleSourceUrl prefers the first video block url for video entries', () => {
  const result = resolveArticleSourceUrl({
    articleUrl: 'https://www.youtube.com/channel/UC1234567890',
    siteUrl: 'https://www.youtube.com/channel/UC1234567890',
    contentBlocks: [
      {
        id: 'video-0',
        type: 'video',
        text: '',
        imageUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
  })

  assert.equal(result, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
})

test('resolveArticleSourceUrl falls back to articleUrl when there is no video block', () => {
  const result = resolveArticleSourceUrl({
    articleUrl: 'https://example.com/posts/42',
    siteUrl: 'https://example.com',
    contentBlocks: [],
  })

  assert.equal(result, 'https://example.com/posts/42')
})

test('resolveArticleSourceUrl falls back to siteUrl when articleUrl is empty', () => {
  const result = resolveArticleSourceUrl({
    articleUrl: '',
    siteUrl: 'https://example.com',
    contentBlocks: [],
  })

  assert.equal(result, 'https://example.com')
})
