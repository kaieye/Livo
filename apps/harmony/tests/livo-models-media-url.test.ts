import test from 'node:test'
import assert from 'node:assert/strict'

import { selectArticleVideoUrls } from '../entry/src/main/ets/common/utils/ArticleVideoSource.ts'

test('selectArticleVideoUrls prioritizes direct media urls from feed metadata', () => {
  const videoUrls = selectArticleVideoUrls(
    ['https://cdn.example.com/video.mp4'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  )

  assert.deepEqual(videoUrls, ['https://cdn.example.com/video.mp4'])
})

test('selectArticleVideoUrls falls back to extracted article video urls when feed media urls are absent', () => {
  const videoUrls = selectArticleVideoUrls(
    [],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  )

  assert.deepEqual(videoUrls, ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
})

test('selectArticleVideoUrls keeps only unique direct media urls when available', () => {
  const videoUrls = selectArticleVideoUrls(
    [
      'https://cdn.example.com/video.mp4',
      'https://cdn.example.com/video.mp4',
      'https://cdn.example.com/video.m3u8',
    ],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  )

  assert.deepEqual(videoUrls, [
    'https://cdn.example.com/video.mp4',
    'https://cdn.example.com/video.m3u8',
  ])
})
