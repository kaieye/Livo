import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveYouTubePlaybackDisplay } from '../entry/src/main/ets/common/utils/YouTubePlaybackDisplay.ts'

test('resolveYouTubePlaybackDisplay keeps direct playable url when available', () => {
  const result = resolveYouTubePlaybackDisplay(
    'https://cdn.example.com/video.mp4',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  )

  assert.deepEqual(result, {
    playableUrl: 'https://cdn.example.com/video.mp4',
    fallbackUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    actionHint: '',
  })
})

test('resolveYouTubePlaybackDisplay keeps web fallback when no direct playable url exists', () => {
  const result = resolveYouTubePlaybackDisplay(
    '',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  )

  assert.deepEqual(result, {
    playableUrl: '',
    fallbackUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    actionHint: '',
  })
})

test('resolveYouTubePlaybackDisplay only shows failure hint when both direct and fallback urls are absent', () => {
  const result = resolveYouTubePlaybackDisplay('', '')

  assert.deepEqual(result, {
    playableUrl: '',
    fallbackUrl: '',
    actionHint: '当前视频暂时无法解析直链，请稍后重试',
  })
})
