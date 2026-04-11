import test from 'node:test'
import assert from 'node:assert/strict'

import {
  shouldOpenYouTubeExternallyOnFallback,
  shouldUseYouTubeWebFallback,
} from '../entry/src/main/ets/common/utils/YouTubePlaybackMode.ts'

test('shouldOpenYouTubeExternallyOnFallback disables in-app web fallback for youtube playback', () => {
  assert.equal(shouldOpenYouTubeExternallyOnFallback(), false)
})

test('shouldUseYouTubeWebFallback disables in-card web fallback for youtube playback', () => {
  assert.equal(shouldUseYouTubeWebFallback(), false)
})
