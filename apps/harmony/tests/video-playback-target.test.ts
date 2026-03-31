import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveVideoPlaybackTarget } from '../entry/src/main/ets/common/utils/VideoPlaybackTarget.ts'

test('resolveVideoPlaybackTarget routes youtube videos to the dedicated player page', () => {
  assert.equal(resolveVideoPlaybackTarget(true, false), 'dedicated')
})

test('resolveVideoPlaybackTarget keeps direct media files inline', () => {
  assert.equal(resolveVideoPlaybackTarget(false, true), 'inline')
})

test('resolveVideoPlaybackTarget keeps non-youtube non-direct videos inline', () => {
  assert.equal(resolveVideoPlaybackTarget(false, false), 'inline')
})
