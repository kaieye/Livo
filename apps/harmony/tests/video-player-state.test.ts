import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveVideoPlayerState } from '../entry/src/main/ets/common/utils/VideoPlayerState.ts'

test('resolveVideoPlayerState prefers direct playback when playable url exists', () => {
  assert.deepEqual(
    resolveVideoPlayerState(
      'https://cdn.example.com/video.mp4',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&playnext=0&autoplay=1',
    ),
    {
      mode: 'direct',
      playableUrl: 'https://cdn.example.com/video.mp4',
      fallbackUrl: '',
      actionHint: '',
    },
  )
})

test('resolveVideoPlayerState uses web fallback when direct playback is unavailable', () => {
  assert.deepEqual(
    resolveVideoPlayerState(
      '',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&playnext=0&autoplay=1',
    ),
    {
      mode: 'web',
      playableUrl: '',
      fallbackUrl:
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ&playnext=0&autoplay=1',
      actionHint: '',
    },
  )
})

test('resolveVideoPlayerState returns failure state when both urls are absent', () => {
  assert.deepEqual(resolveVideoPlayerState('', ''), {
    mode: 'error',
    playableUrl: '',
    fallbackUrl: '',
    actionHint: '当前视频暂时无法解析直链，请稍后重试',
  })
})
