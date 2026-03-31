import test from 'node:test'
import assert from 'node:assert/strict'

import { buildYouTubeWebFallbackUrl } from '../entry/src/main/ets/common/utils/YouTubePlaybackUrl.ts'

test('buildYouTubeWebFallbackUrl returns official mobile watch page for watch urls', () => {
  assert.equal(
    buildYouTubeWebFallbackUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ&playnext=0&autoplay=1',
  )
})

test('buildYouTubeWebFallbackUrl returns empty string for non-YouTube urls', () => {
  assert.equal(buildYouTubeWebFallbackUrl('https://example.com/video.mp4'), '')
})
