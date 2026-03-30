import test from 'node:test'
import assert from 'node:assert/strict'

import { buildYouTubeWebFallbackUrl } from '../entry/src/main/ets/common/utils/YouTubePlaybackUrl.ts'

test('buildYouTubeWebFallbackUrl returns official YouTube embed page for watch urls', () => {
  assert.equal(
    buildYouTubeWebFallbackUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=1&autoplay=1&mute=0&playsinline=1&rel=0',
  )
})

test('buildYouTubeWebFallbackUrl returns empty string for non-YouTube urls', () => {
  assert.equal(buildYouTubeWebFallbackUrl('https://example.com/video.mp4'), '')
})
