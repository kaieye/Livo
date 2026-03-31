import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveVideoPlayerLaunchState } from '../entry/src/main/ets/common/utils/VideoPlayerLaunchState.ts'

test('resolveVideoPlayerLaunchState opens direct media files immediately', () => {
  assert.deepEqual(
    resolveVideoPlayerLaunchState(
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

test('resolveVideoPlayerLaunchState opens youtube fallback page immediately', () => {
  assert.deepEqual(
    resolveVideoPlayerLaunchState(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
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

test('resolveVideoPlayerLaunchState returns error when nothing playable is available', () => {
  assert.deepEqual(resolveVideoPlayerLaunchState('', ''), {
    mode: 'error',
    playableUrl: '',
    fallbackUrl: '',
    actionHint: '当前视频暂时无法在应用内播放',
  })
})
